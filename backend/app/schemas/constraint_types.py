"""
Strict, typed schemas for the LLM constraint-extraction output.

These describe what the LLM itself must produce: entities referenced by
*name* (it doesn't know database ids), with `constraint_type` as a
discriminator so Pydantic can validate each of the six fixed constraint
shapes independently and reject anything that doesn't match one of them.

This is deliberately a *separate* module from `app/models/constraint.py`'s
`ConstraintType` enum: this file is the LLM-facing contract (names, before
DB resolution); the model stores the DB-facing contract (ids, after
resolution - produced by `app/llm/resolver.py`). Keeping them separate makes
each side's responsibility unambiguous.
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class TeacherUnavailablePayload(BaseModel):
    constraint_type: Literal["teacher_unavailable"] = "teacher_unavailable"
    teacher_name: str = Field(..., description="Exact or partial name of the teacher, as it appears in the roster")
    day_names: list[str] = Field(..., min_length=1, description="Day name(s), e.g. ['Friday']")
    periods: list[int] = Field(
        default_factory=list,
        description="1-8 period numbers the teacher is unavailable. Empty list means the whole day.",
    )


class TeacherPreferredSlotPayload(BaseModel):
    constraint_type: Literal["teacher_preferred_slot"] = "teacher_preferred_slot"
    teacher_name: str = Field(..., description="Exact or partial name of the teacher")
    day_names: list[str] = Field(default_factory=list, description="Empty list means every day")
    periods: list[int] = Field(..., min_length=1, description="1-8 period numbers the teacher prefers to teach in")


class SubjectTimePreferencePayload(BaseModel):
    constraint_type: Literal["subject_time_preference"] = "subject_time_preference"
    subject_name: str = Field(..., description="Exact or partial subject name")
    class_name: str | None = Field(
        default=None, description="e.g. 'Grade 10 - A' or 'Class 10'. Null applies to every class."
    )
    day_names: list[str] = Field(default_factory=list, description="Empty list means every day")
    periods: list[int] = Field(..., min_length=1, description="1-8 preferred period numbers for this subject")


class MaxPeriodsPerDayPayload(BaseModel):
    constraint_type: Literal["max_periods_per_day"] = "max_periods_per_day"
    scope: Literal["teacher", "class_subject"]
    teacher_name: str | None = Field(default=None, description="Required when scope == 'teacher'")
    class_name: str | None = Field(default=None, description="Required when scope == 'class_subject'")
    subject_name: str | None = Field(default=None, description="Required when scope == 'class_subject'")
    max_periods: int = Field(..., ge=1, le=10)


class NoConsecutivePayload(BaseModel):
    constraint_type: Literal["no_consecutive"] = "no_consecutive"
    teacher_name: str = Field(..., description="Exact or partial name of the teacher")
    max_consecutive: int = Field(..., ge=1, le=8)


class RoomRequirementPayload(BaseModel):
    constraint_type: Literal["room_requirement"] = "room_requirement"
    subject_name: str = Field(..., description="Exact or partial subject name")
    class_name: str | None = Field(default=None, description="Null applies to every class taking the subject")
    room_names: list[str] = Field(..., min_length=1, description="One or more specific room names")


class ClassTeacherPeriodPayload(BaseModel):
    constraint_type: Literal["class_teacher_period"] = "class_teacher_period"
    class_name: str | None = Field(
        default=None, description="One class, e.g. 'Grade 6 - A'. Null means every class."
    )
    periods: list[int] = Field(..., min_length=1, description="Period numbers the class teacher should teach their class in, e.g. [1]")


class ClassSubjectAssignmentPayload(BaseModel):
    constraint_type: Literal["class_subject_assignment"] = "class_subject_assignment"
    class_name: str = Field(..., description="The class, e.g. 'Grade 6 - A'")
    subject_name: str = Field(..., description="The subject taught to that class")
    teacher_name: str | None = Field(default=None, description="Who teaches it; null leaves the choice open")
    periods_per_week: int | None = Field(default=None, ge=1, le=20, description="How many periods a week; null keeps the current number")


ConstraintPayloadUnion = Annotated[
    Union[
        TeacherUnavailablePayload,
        TeacherPreferredSlotPayload,
        SubjectTimePreferencePayload,
        MaxPeriodsPerDayPayload,
        NoConsecutivePayload,
        RoomRequirementPayload,
        ClassTeacherPeriodPayload,
        ClassSubjectAssignmentPayload,
    ],
    Field(discriminator="constraint_type"),
]


class ParsedConstraint(BaseModel):
    """A successfully extracted constraint, still name-based (pre-DB-resolution)."""

    payload: ConstraintPayloadUnion
    severity: Literal["hard", "soft"] = Field(
        default="hard", description="'hard' = must never be violated. 'soft' = preference, penalized if violated."
    )
    weight: float = Field(default=3.0, ge=0.1, le=20.0, description="Only meaningful when severity == 'soft'")
    explanation: str = Field(..., description="One-sentence plain-English paraphrase of what was understood")
    confidence: Literal["high", "medium", "low"] = "high"


class ClarificationNeeded(BaseModel):
    """Raised instead of `ParsedConstraint` when a name is ambiguous, unknown,
    or the sentence doesn't map cleanly onto one of the six constraint types."""

    clarification_question: str
    ambiguous_term: str | None = None
    candidates: list[str] = Field(default_factory=list)


class LLMConstraintResponse(BaseModel):
    """Top-level envelope the LLM is required to produce. Exactly one of
    `parsed` / `clarification` is populated, matching `result`."""

    result: Literal["parsed", "clarification_needed", "unparseable"]
    parsed: ParsedConstraint | None = None
    clarification: ClarificationNeeded | None = None
    error_message: str | None = Field(
        default=None, description="Only for result == 'unparseable': why this isn't a schedulable constraint"
    )
