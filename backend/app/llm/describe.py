"""Turns a resolved, id-based constraint payload back into a human-readable
sentence - used for the confirm/edit/reject card in the frontend so the
admin can double check what will actually be saved, not just the LLM's own
paraphrase (which could itself be subtly wrong)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.day import Day
from app.models.room import Room
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher

_PERIOD_LABELS = {1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th"}


def _periods_phrase(periods: list[int]) -> str:
    if not periods:
        return "the whole day"
    if periods == [1, 2, 3, 4]:
        return "the morning (periods 1-4)"
    if periods == [5, 6, 7, 8]:
        return "the afternoon (periods 5-8)"
    labels = [_PERIOD_LABELS.get(p, str(p)) for p in periods]
    return "period" + ("s" if len(labels) > 1 else "") + " " + ", ".join(labels)


def describe_resolved_constraint(db: Session, constraint_type: str, payload: dict) -> str:
    if constraint_type == "teacher_unavailable":
        teacher = db.get(Teacher, payload["teacher_id"])
        days = _day_names(db, payload.get("day_ids"))
        return (
            f"{teacher.name if teacher else '?'} is unavailable "
            f"{'every day' if not days else 'on ' + ', '.join(days)} during {_periods_phrase(payload.get('periods', []))}."
        )

    if constraint_type == "teacher_preferred_slot":
        teacher = db.get(Teacher, payload["teacher_id"])
        days = _day_names(db, payload.get("day_ids"))
        return (
            f"{teacher.name if teacher else '?'} prefers to teach "
            f"{'every day' if not days else 'on ' + ', '.join(days)} during {_periods_phrase(payload.get('periods', []))}."
        )

    if constraint_type == "subject_time_preference":
        subject = db.get(Subject, payload["subject_id"])
        class_name = "all classes"
        if payload.get("class_id"):
            school_class = db.get(SchoolClass, payload["class_id"])
            class_name = school_class.display_name if school_class else "?"
        days = _day_names(db, payload.get("day_ids"))
        return (
            f"{subject.name if subject else '?'} should be scheduled during "
            f"{_periods_phrase(payload.get('periods', []))} for {class_name}"
            f"{', on ' + ', '.join(days) if days else ''}."
        )

    if constraint_type == "max_periods_per_day":
        if payload.get("scope") == "teacher":
            teacher = db.get(Teacher, payload["teacher_id"])
            return f"{teacher.name if teacher else '?'} should teach at most {payload['max_periods']} period(s) per day."
        school_class = db.get(SchoolClass, payload.get("class_id"))
        subject = db.get(Subject, payload.get("subject_id"))
        return (
            f"{school_class.display_name if school_class else '?'} should have at most "
            f"{payload['max_periods']} {subject.name if subject else '?'} period(s) per day."
        )

    if constraint_type == "class_subject_assignment":
        school_class = db.get(SchoolClass, payload.get("class_id"))
        subject = db.get(Subject, payload.get("subject_id"))
        teacher = db.get(Teacher, payload["teacher_id"]) if payload.get("teacher_id") else None
        bits = []
        if teacher:
            bits.append(f"{teacher.name} teaches")
        else:
            bits.append("Teach")
        bits.append(f"{subject.name if subject else '?'} to {school_class.display_name if school_class else '?'}")
        if payload.get("periods_per_week"):
            bits.append(f"for {payload['periods_per_week']} period(s) a week")
        return " ".join(bits) + "."

    if constraint_type == "class_teacher_period":
        where = "every class"
        if payload.get("class_id"):
            school_class = db.get(SchoolClass, payload["class_id"])
            where = school_class.display_name if school_class else "?"
        return f"The class teacher of {where} teaches that class during {_periods_phrase(payload.get('periods', []))}, every day."

    if constraint_type == "no_consecutive":
        teacher = db.get(Teacher, payload["teacher_id"])
        return f"{teacher.name if teacher else '?'} should not teach more than {payload['max_consecutive']} periods in a row."

    if constraint_type == "room_requirement":
        subject = db.get(Subject, payload.get("subject_id"))
        rooms = [db.get(Room, rid) for rid in payload.get("room_ids", [])]
        room_names = ", ".join(r.name for r in rooms if r)
        class_name = "all classes"
        if payload.get("class_id"):
            school_class = db.get(SchoolClass, payload["class_id"])
            class_name = school_class.display_name if school_class else "?"
        return f"{subject.name if subject else '?'} must be held in {room_names} for {class_name}."

    return "Unrecognized constraint."


def _day_names(db: Session, day_ids: list[int] | None) -> list[str]:
    if not day_ids:
        return []
    days = db.query(Day).filter(Day.id.in_(day_ids)).order_by(Day.order_index).all()
    return [d.name for d in days]
