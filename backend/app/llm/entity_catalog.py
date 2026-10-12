"""
Loads the current set of teachers/subjects/classes/days/periods out of the
database, in a form the LLM system prompt can list verbatim ("only refer to
entities in this list") and the resolver can match free-text names against.

This is what stops the LLM from inventing a teacher or subject that doesn't
exist: it is only ever shown - and only ever allowed to reference - names
that are actually in the database at parse time.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.day import Day
from app.models.period import Period
from app.models.room import Room
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject


@dataclass
class SchoolEntities:
    teachers: list[Teacher]
    subjects: list[Subject]
    classes: list[SchoolClass]
    days: list[Day]
    periods: list[Period]  # teaching periods only
    rooms: list[Room]
    # teacher_id -> [subject names], shown in the prompt so the LLM/resolver
    # can disambiguate "Mrs. Rao" when there are two teachers named Rao
    # ("Kavita Rao teaches Science" vs "Lakshmi Pillai teaches PE" etc).
    subjects_taught_by_teacher: dict[int, list[str]] = field(default_factory=dict)

    def teacher_display(self, teacher: Teacher) -> str:
        subjects = self.subjects_taught_by_teacher.get(teacher.id, [])
        suffix = f" (teaches {', '.join(subjects)})" if subjects else ""
        return f"{teacher.name}{suffix}"

    def class_display(self, school_class: SchoolClass) -> str:
        ct = f"class teacher: {school_class.class_teacher_name}" if school_class.class_teacher_name else "no class teacher assigned"
        return f"{school_class.display_name} ({ct})"


def load_school_entities(db: Session, tenant_id: int) -> SchoolEntities:
    teachers = list(
        db.scalars(
            select(Teacher).where(Teacher.is_active.is_(True), Teacher.tenant_id == tenant_id).order_by(Teacher.name)
        ).all()
    )
    subjects = list(db.scalars(select(Subject).where(Subject.tenant_id == tenant_id).order_by(Subject.name)).all())
    classes = list(
        db.scalars(
            select(SchoolClass)
            .where(SchoolClass.tenant_id == tenant_id)
            .options(joinedload(SchoolClass.class_teacher))
            .order_by(SchoolClass.grade, SchoolClass.section)
        ).all()
    )
    days = list(db.scalars(select(Day).where(Day.tenant_id == tenant_id).order_by(Day.order_index)).all())
    periods = list(
        db.scalars(
            select(Period)
            .where(Period.is_break.is_(False), Period.tenant_id == tenant_id)
            .order_by(Period.period_number)
        ).all()
    )
    rooms = list(db.scalars(select(Room).where(Room.tenant_id == tenant_id).order_by(Room.name)).all())

    subjects_by_id = {s.id: s.name for s in subjects}
    teacher_ids = {t.id for t in teachers}
    links = [
        link for link in db.scalars(select(TeacherSubject)).all() if link.teacher_id in teacher_ids
    ]
    subjects_taught: dict[int, list[str]] = {}
    for link in links:
        name = subjects_by_id.get(link.subject_id)
        if name:
            subjects_taught.setdefault(link.teacher_id, []).append(name)

    return SchoolEntities(
        teachers=teachers,
        subjects=subjects,
        classes=classes,
        days=days,
        periods=periods,
        rooms=rooms,
        subjects_taught_by_teacher=subjects_taught,
    )
