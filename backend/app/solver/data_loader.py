"""
Loads everything the CP-SAT solver needs out of the database into a plain,
solver-friendly in-memory structure (`SolverInput`).

Keeping this separate from `model_builder.py` means the solver's core logic
never touches SQLAlchemy directly - it only sees dataclasses and dicts, which
also makes the solver easy to unit-test with hand-built fixtures.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.class_subject_requirement import ClassSubjectRequirement
from app.models.constraint import Constraint
from app.models.day import Day
from app.models.period import Period
from app.models.room import Room, RoomType
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject


@dataclass
class SolverInput:
    """Immutable snapshot of the scheduling problem, ready for the CP-SAT model builder."""

    classes: list[SchoolClass]
    subjects: list[Subject]
    teachers: list[Teacher]
    rooms: list[Room]
    days: list[Day]
    periods: list[Period]  # teaching periods only (is_break == False), sorted chronologically
    requirements: list[ClassSubjectRequirement]  # periods/week per (class, subject)
    active_constraints: list[Constraint]

    # ---- derived lookups, built once in __post_init__ for O(1) access ----
    subjects_by_id: dict[int, Subject] = field(default_factory=dict)
    classes_by_id: dict[int, SchoolClass] = field(default_factory=dict)
    teachers_by_id: dict[int, Teacher] = field(default_factory=dict)
    rooms_by_id: dict[int, Room] = field(default_factory=dict)

    # class_id -> {subject_id: periods_per_week}
    requirements_by_class: dict[int, dict[int, int]] = field(default_factory=dict)
    # subject_id -> [teacher_id, ...] qualified to teach it
    qualified_teachers_for_subject: dict[int, list[int]] = field(default_factory=dict)
    # (class_id, subject_id) -> teacher_id, only present when a specific
    # teacher has been pinned (via ClassSubjectRequirement.teacher_id)
    # instead of leaving the solver free to pick any qualified teacher.
    pinned_teacher_by_class_subject: dict[tuple[int, int], int] = field(default_factory=dict)

    classroom_room_ids: list[int] = field(default_factory=list)
    lab_room_ids: list[int] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.subjects_by_id = {s.id: s for s in self.subjects}
        self.classes_by_id = {c.id: c for c in self.classes}
        self.teachers_by_id = {t.id: t for t in self.teachers}
        self.rooms_by_id = {r.id: r for r in self.rooms}

        for req in self.requirements:
            self.requirements_by_class.setdefault(req.class_id, {})[req.subject_id] = req.periods_per_week
            if req.teacher_id is not None:
                self.pinned_teacher_by_class_subject[(req.class_id, req.subject_id)] = req.teacher_id

        for r in self.rooms:
            if r.room_type == RoomType.LAB:
                self.lab_room_ids.append(r.id)
            elif r.room_type == RoomType.CLASSROOM:
                self.classroom_room_ids.append(r.id)
            # auditorium/sports rooms are not part of the default pools; a
            # `room_requirement` constraint can still target them explicitly.

    def room_pool_for_subject(self, subject_id: int) -> list[int]:
        """The default room pool a subject draws from, before any explicit
        `room_requirement` constraint narrows it further."""
        subject = self.subjects_by_id[subject_id]
        return self.lab_room_ids if subject.is_lab else self.classroom_room_ids


def load_solver_input(db: Session, tenant_id: int) -> SolverInput:
    """Read the full scheduling problem out of the database, scoped to one tenant."""
    classes = list(db.scalars(select(SchoolClass).where(SchoolClass.tenant_id == tenant_id).order_by(SchoolClass.id)).all())
    subjects = list(db.scalars(select(Subject).where(Subject.tenant_id == tenant_id).order_by(Subject.id)).all())
    teachers = list(
        db.scalars(
            select(Teacher).where(Teacher.is_active.is_(True), Teacher.tenant_id == tenant_id).order_by(Teacher.id)
        ).all()
    )
    rooms = list(db.scalars(select(Room).where(Room.tenant_id == tenant_id).order_by(Room.id)).all())
    days = list(db.scalars(select(Day).where(Day.tenant_id == tenant_id).order_by(Day.order_index)).all())
    periods = list(
        db.scalars(
            select(Period).where(Period.is_break.is_(False), Period.tenant_id == tenant_id).order_by(Period.period_number)
        ).all()
    )
    class_ids = {c.id for c in classes}
    requirements = [
        r for r in db.scalars(select(ClassSubjectRequirement)).all() if r.class_id in class_ids
    ]
    active_constraints = list(
        db.scalars(
            select(Constraint).where(Constraint.is_active.is_(True), Constraint.tenant_id == tenant_id)
        ).all()
    )

    solver_input = SolverInput(
        classes=classes,
        subjects=subjects,
        teachers=teachers,
        rooms=rooms,
        days=days,
        periods=periods,
        requirements=requirements,
        active_constraints=active_constraints,
    )

    # Qualified teachers per subject, loaded separately to keep the query simple.
    active_teacher_ids = {t.id for t in teachers}
    links = [link for link in db.scalars(select(TeacherSubject)).all() if link.teacher_id in active_teacher_ids]
    for link in links:
        if link.teacher_id in active_teacher_ids:
            solver_input.qualified_teachers_for_subject.setdefault(link.subject_id, []).append(link.teacher_id)

    _apply_assignment_constraints(solver_input)
    return solver_input


def _apply_assignment_constraints(si: SolverInput) -> None:
    """`class_subject_assignment` constraints override the per-class weekly
    periods and/or pin a teacher, on top of the Classes-page data."""
    for c in si.active_constraints:
        if c.constraint_type.value != "class_subject_assignment":
            continue
        p = c.payload or {}
        key = (p.get("class_id"), p.get("subject_id"))
        if None in key or key[0] not in si.classes_by_id:
            continue
        if p.get("periods_per_week"):
            si.requirements_by_class.setdefault(key[0], {})[key[1]] = int(p["periods_per_week"])
        if p.get("teacher_id"):
            si.pinned_teacher_by_class_subject[key] = int(p["teacher_id"])
