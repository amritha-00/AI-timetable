"""
Resolves a name-based `ParsedConstraint` (what the LLM produced) against the
real database, turning it into the id-based payload the solver expects
(`app/solver/model_builder.py`'s `_apply_db_constraint`).

This is where "never guess" is actually enforced: every name is checked
against the live roster, and anything unknown or ambiguous short-circuits
into a `ClarificationNeeded` instead of silently picking one.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Union

from app.llm.entity_catalog import SchoolEntities
from app.llm.prompts import VAGUE_DAY_PHRASE_MAP, VAGUE_PHRASE_MAP
from app.models.room import Room
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.schemas.constraint_types import (
    ClarificationNeeded,
    MaxPeriodsPerDayPayload,
    NoConsecutivePayload,
    ParsedConstraint,
    RoomRequirementPayload,
    SubjectTimePreferencePayload,
    ClassTeacherPeriodPayload,
    ClassSubjectAssignmentPayload,
    TeacherPreferredSlotPayload,
    TeacherUnavailablePayload,
)

_HONORIFICS = re.compile(r"^(mr|mrs|ms|dr|miss)\.?\s+", re.IGNORECASE)

_SUBJECT_ALIASES = {
    "maths": "mathematics", "math": "mathematics",
    "pe": "physical education", "phy ed": "physical education", "phys ed": "physical education",
    "cs": "computer science", "comp sci": "computer science", "computers": "computer science",
    "gk": "general knowledge",
    "sst": "social studies", "social science": "social studies",
    "eng": "english", "hin": "hindi",
}


@dataclass
class ResolvedConstraint:
    constraint_type: str  # matches app.models.constraint.ConstraintType values
    payload: dict
    severity: str
    weight: float
    explanation: str


def _strip_honorific(name: str) -> str:
    return _HONORIFICS.sub("", name).strip()


def _match_teacher(entities: SchoolEntities, query: str) -> tuple[Teacher | None, list[str]]:
    """Returns (teacher, candidate_display_strings). Exactly one of
    (teacher is not None) / (candidates non-empty as ambiguous) / (both
    empty, meaning not found) holds."""
    cleaned = _strip_honorific(query).lower().strip()
    if not cleaned:
        return None, []

    # Fallback for "class teacher of <class>" / "<class>'s class teacher":
    # the system prompt already instructs the LLM to resolve this to the
    # actual teacher's name itself using the class-teacher roster it's
    # shown, but this catches it here too in case the LLM passes the phrase
    # through verbatim instead.
    class_teacher_match = (
        re.search(r"class teacher(?:\s+of)?\s+(.+)", cleaned)
        or re.search(r"(.+?)'s\s+class teacher", cleaned)
        or re.search(r"(.+?)\s+class teacher$", cleaned)
    )
    if class_teacher_match:
        school_class, _ = _match_class(entities, class_teacher_match.group(1))
        if school_class and school_class.class_teacher_id:
            resolved = next((t for t in entities.teachers if t.id == school_class.class_teacher_id), None)
            if resolved:
                return resolved, []

    exact = [t for t in entities.teachers if t.name.lower() == cleaned]
    if len(exact) == 1:
        return exact[0], []

    query_tokens = set(cleaned.split())
    token_matches = [
        t for t in entities.teachers if query_tokens & {tok.lower() for tok in t.name.split()}
    ]
    substring_matches = [t for t in entities.teachers if cleaned in t.name.lower() or t.name.lower() in cleaned]
    matches = list({t.id: t for t in (token_matches or substring_matches)}.values())

    if len(matches) == 1:
        return matches[0], []
    if len(matches) > 1:
        return None, [entities.teacher_display(t) for t in matches]
    return None, []


def _match_subject(entities: SchoolEntities, query: str) -> tuple[Subject | None, list[str]]:
    cleaned = query.lower().strip()
    # Try the raw term against this school's actual subject names/codes
    # FIRST - a school may genuinely have a subject called "Maths" or "PE",
    # in which case the alias table below (which assumes a canonical
    # "Mathematics"/"Physical Education" name) must never shadow that real,
    # exact match.
    for candidate in (cleaned, _SUBJECT_ALIASES.get(cleaned, cleaned)):
        exact = [s for s in entities.subjects if s.name.lower() == candidate or s.code.lower() == candidate]
        if len(exact) == 1:
            return exact[0], []
    partial = [s for s in entities.subjects if cleaned in s.name.lower() or s.name.lower() in cleaned]
    if len(partial) == 1:
        return partial[0], []
    if len(partial) > 1:
        return None, [s.name for s in partial]
    return None, []


def _match_class(entities: SchoolEntities, query: str) -> tuple[SchoolClass | None, list[str]]:
    cleaned = query.lower().strip()
    m = re.search(r"(\d{1,2})\s*-?\s*([a-z])?\b", cleaned)
    if not m:
        return None, []
    grade = int(m.group(1))
    section = m.group(2).upper() if m.group(2) else None

    same_grade = [c for c in entities.classes if c.grade == grade]
    if section:
        exact = [c for c in same_grade if c.section.upper() == section]
        if len(exact) == 1:
            return exact[0], []
        return None, []
    if len(same_grade) == 1:
        return same_grade[0], []
    if len(same_grade) > 1:
        return None, [c.display_name for c in same_grade]
    return None, []


def _match_room(entities: SchoolEntities, query: str) -> tuple[Room | None, list[str]]:
    cleaned = query.lower().strip()
    exact = [r for r in entities.rooms if r.name.lower() == cleaned]
    if len(exact) == 1:
        return exact[0], []
    partial = [r for r in entities.rooms if cleaned in r.name.lower() or r.name.lower() in cleaned]
    if len(partial) == 1:
        return partial[0], []
    if len(partial) > 1:
        return None, [r.name for r in partial]
    return None, []


def _match_days(entities: SchoolEntities, day_names: list[str]) -> tuple[list[int] | None, list[str]]:
    """Returns (day_ids, unknown_names). day_ids is None only if day_names was empty."""
    if not day_names:
        return None, []
    by_name = {d.name.lower(): d.id for d in entities.days}
    day_ids: list[int] = []
    unknown: list[str] = []
    for name in day_names:
        key = name.lower().strip()
        if key in by_name:
            day_ids.append(by_name[key])
        elif key in VAGUE_DAY_PHRASE_MAP:
            for expanded in VAGUE_DAY_PHRASE_MAP[key]:
                expanded_id = by_name.get(expanded.lower())
                if expanded_id:
                    day_ids.append(expanded_id)
        else:
            unknown.append(name)
    return day_ids, unknown


def _apply_vague_period_fallback(raw_text: str, periods: list[int]) -> list[int]:
    """If the LLM left `periods` empty but the raw sentence clearly says
    'morning' or 'afternoon', fill it in deterministically rather than
    trusting the model's own arithmetic."""
    if periods:
        return periods
    lowered = raw_text.lower()
    for phrase, mapped in VAGUE_PHRASE_MAP.items():
        if phrase in lowered:
            return mapped
    return periods


def resolve_constraint(
    entities: SchoolEntities, parsed: ParsedConstraint, raw_text: str
) -> Union[ResolvedConstraint, ClarificationNeeded]:
    payload = parsed.payload

    if isinstance(payload, TeacherUnavailablePayload):
        teacher, candidates = _match_teacher(entities, payload.teacher_name)
        if teacher is None:
            return _teacher_not_found_or_ambiguous(payload.teacher_name, candidates)
        day_ids, unknown_days = _match_days(entities, payload.day_names)
        if unknown_days:
            return _unknown_days_clarification(unknown_days, entities)
        periods = _apply_vague_period_fallback(raw_text, payload.periods)
        db_payload: dict = {"teacher_id": teacher.id, "periods": periods}
        if day_ids:
            db_payload["day_ids"] = day_ids
        return ResolvedConstraint(
            constraint_type="teacher_unavailable", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, ClassSubjectAssignmentPayload):
        school_class, class_candidates = _match_class(entities, payload.class_name)
        if school_class is None:
            return ClarificationNeeded(
                clarification_question=f"Which class do you mean by '{payload.class_name}'?"
                + (f" Did you mean: {', '.join(class_candidates)}?" if class_candidates else ""),
                ambiguous_term=payload.class_name, candidates=class_candidates,
            )
        subject, subj_candidates = _match_subject(entities, payload.subject_name)
        if subject is None:
            return ClarificationNeeded(
                clarification_question=f"Which subject do you mean by '{payload.subject_name}'?",
                ambiguous_term=payload.subject_name, candidates=subj_candidates,
            )
        db_payload = {"class_id": school_class.id, "subject_id": subject.id}
        if payload.periods_per_week:
            db_payload["periods_per_week"] = payload.periods_per_week
        if payload.teacher_name:
            teacher, candidates = _match_teacher(entities, payload.teacher_name)
            if teacher is None:
                return _teacher_not_found_or_ambiguous(payload.teacher_name, candidates)
            if subject.name not in entities.subjects_taught_by_teacher.get(teacher.id, []):
                return ClarificationNeeded(
                    clarification_question=f"{teacher.name} isn't set up to teach {subject.name}. "
                    "Add the subject to their profile on the Teachers page first, or pick a different subject.",
                )
            db_payload["teacher_id"] = teacher.id
        if "teacher_id" not in db_payload and "periods_per_week" not in db_payload:
            return ClarificationNeeded(
                clarification_question=f"What should I set for {subject.name} in {school_class.display_name}: a teacher, or periods per week?"
            )
        return ResolvedConstraint(
            constraint_type="class_subject_assignment", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, ClassTeacherPeriodPayload):
        db_payload = {"periods": _apply_vague_period_fallback(raw_text, payload.periods)}
        if payload.class_name:
            school_class, class_candidates = _match_class(entities, payload.class_name)
            if school_class is None:
                return ClarificationNeeded(
                    clarification_question=f"'{payload.class_name}' doesn't clearly match one class. "
                    + (f"Did you mean: {', '.join(class_candidates)}?" if class_candidates else "Please give the grade and section."),
                    ambiguous_term=payload.class_name, candidates=class_candidates,
                )
            db_payload["class_id"] = school_class.id
        return ResolvedConstraint(
            constraint_type="class_teacher_period", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, TeacherPreferredSlotPayload):
        teacher, candidates = _match_teacher(entities, payload.teacher_name)
        if teacher is None:
            return _teacher_not_found_or_ambiguous(payload.teacher_name, candidates)
        day_ids, unknown_days = _match_days(entities, payload.day_names)
        if unknown_days:
            return _unknown_days_clarification(unknown_days, entities)
        periods = _apply_vague_period_fallback(raw_text, payload.periods)
        db_payload = {"teacher_id": teacher.id, "periods": periods}
        if day_ids:  # omit when empty so the solver defaults to "every day"
            db_payload["day_ids"] = day_ids
        return ResolvedConstraint(
            constraint_type="teacher_preferred_slot", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, SubjectTimePreferencePayload):
        subject, subj_candidates = _match_subject(entities, payload.subject_name)
        if subject is None:
            return ClarificationNeeded(
                clarification_question=(
                    f"I couldn't find a subject matching '{payload.subject_name}'. "
                    + (f"Did you mean one of: {', '.join(subj_candidates)}?" if subj_candidates
                       else f"Available subjects: {', '.join(s.name for s in entities.subjects)}.")
                ),
                ambiguous_term=payload.subject_name, candidates=subj_candidates,
            )
        class_id = None
        if payload.class_name:
            school_class, class_candidates = _match_class(entities, payload.class_name)
            if school_class is None:
                return ClarificationNeeded(
                    clarification_question=(
                        f"'{payload.class_name}' doesn't clearly match one class. "
                        + (f"Did you mean: {', '.join(class_candidates)}?" if class_candidates
                           else "Please specify the grade and section, e.g. 'Grade 10 - A'.")
                    ),
                    ambiguous_term=payload.class_name, candidates=class_candidates,
                )
            class_id = school_class.id
        day_ids, unknown_days = _match_days(entities, payload.day_names)
        if unknown_days:
            return _unknown_days_clarification(unknown_days, entities)
        periods = _apply_vague_period_fallback(raw_text, payload.periods)
        db_payload = {"subject_id": subject.id, "periods": periods}
        if class_id is not None:
            db_payload["class_id"] = class_id
        if day_ids:
            db_payload["day_ids"] = day_ids
        return ResolvedConstraint(
            constraint_type="subject_time_preference", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, MaxPeriodsPerDayPayload):
        if payload.scope == "teacher":
            if not payload.teacher_name:
                return ClarificationNeeded(clarification_question="Which teacher should this limit apply to?")
            teacher, candidates = _match_teacher(entities, payload.teacher_name)
            if teacher is None:
                return _teacher_not_found_or_ambiguous(payload.teacher_name, candidates)
            db_payload = {"scope": "teacher", "teacher_id": teacher.id, "max_periods": payload.max_periods}
        else:
            if not payload.class_name or not payload.subject_name:
                return ClarificationNeeded(
                    clarification_question="Please specify both the class and the subject for this daily limit."
                )
            school_class, class_candidates = _match_class(entities, payload.class_name)
            if school_class is None:
                return ClarificationNeeded(
                    clarification_question=f"'{payload.class_name}' doesn't clearly match one class."
                    + (f" Did you mean: {', '.join(class_candidates)}?" if class_candidates else ""),
                    ambiguous_term=payload.class_name, candidates=class_candidates,
                )
            subject, subj_candidates = _match_subject(entities, payload.subject_name)
            if subject is None:
                return ClarificationNeeded(
                    clarification_question=f"I couldn't find a subject matching '{payload.subject_name}'.",
                    ambiguous_term=payload.subject_name, candidates=subj_candidates,
                )
            db_payload = {
                "scope": "class_subject", "class_id": school_class.id,
                "subject_id": subject.id, "max_periods": payload.max_periods,
            }
        return ResolvedConstraint(
            constraint_type="max_periods_per_day", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, NoConsecutivePayload):
        teacher, candidates = _match_teacher(entities, payload.teacher_name)
        if teacher is None:
            return _teacher_not_found_or_ambiguous(payload.teacher_name, candidates)
        db_payload = {"teacher_id": teacher.id, "max_consecutive": payload.max_consecutive}
        return ResolvedConstraint(
            constraint_type="no_consecutive", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    if isinstance(payload, RoomRequirementPayload):
        subject, subj_candidates = _match_subject(entities, payload.subject_name)
        if subject is None:
            return ClarificationNeeded(
                clarification_question=f"I couldn't find a subject matching '{payload.subject_name}'.",
                ambiguous_term=payload.subject_name, candidates=subj_candidates,
            )
        class_id = None
        if payload.class_name:
            school_class, class_candidates = _match_class(entities, payload.class_name)
            if school_class is None:
                return ClarificationNeeded(
                    clarification_question=f"'{payload.class_name}' doesn't clearly match one class.",
                    ambiguous_term=payload.class_name, candidates=class_candidates,
                )
            class_id = school_class.id
        room_ids: list[int] = []
        for room_name in payload.room_names:
            room, room_candidates = _match_room(entities, room_name)
            if room is None:
                return ClarificationNeeded(
                    clarification_question=f"I couldn't find a room matching '{room_name}'."
                    + (f" Did you mean: {', '.join(room_candidates)}?" if room_candidates else ""),
                    ambiguous_term=room_name, candidates=room_candidates,
                )
            room_ids.append(room.id)
        db_payload = {"subject_id": subject.id, "room_ids": room_ids}
        if class_id is not None:
            db_payload["class_id"] = class_id
        return ResolvedConstraint(
            constraint_type="room_requirement", payload=db_payload,
            severity=parsed.severity, weight=parsed.weight, explanation=parsed.explanation,
        )

    return ClarificationNeeded(clarification_question="This constraint type isn't recognized.")


def _teacher_not_found_or_ambiguous(query: str, candidates: list[str]) -> ClarificationNeeded:
    if candidates:
        return ClarificationNeeded(
            clarification_question=f"There's more than one teacher matching '{query}': "
            f"{', '.join(candidates)}. Which one did you mean?",
            ambiguous_term=query, candidates=candidates,
        )
    return ClarificationNeeded(
        clarification_question=f"I couldn't find a teacher matching '{query}' on the current staff list.",
        ambiguous_term=query, candidates=[],
    )


def _unknown_days_clarification(unknown_days: list[str], entities: SchoolEntities) -> ClarificationNeeded:
    return ClarificationNeeded(
        clarification_question=f"I don't recognize the day(s): {', '.join(unknown_days)}. "
        f"Valid days are: {', '.join(d.name for d in entities.days)}.",
        ambiguous_term=", ".join(unknown_days),
        candidates=[d.name for d in entities.days],
    )
