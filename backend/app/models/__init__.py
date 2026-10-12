"""
Import every model here so `Base.metadata` is fully populated whenever
`app.db.session.Base` is used (e.g. by `create_all()` in dev scripts,
or by Alembic autogenerate if added later).
"""
from app.models.tenant import Tenant
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.models.school_class import SchoolClass
from app.models.room import Room, RoomType
from app.models.day import Day
from app.models.period import Period
from app.models.teacher_subject import TeacherSubject
from app.models.class_subject_requirement import ClassSubjectRequirement
from app.models.constraint import Constraint, ConstraintType, ConstraintSeverity
from app.models.timetable import Timetable, TimetableEntry, TimetableStatus

__all__ = [
    "Tenant",
    "Teacher",
    "Subject",
    "SchoolClass",
    "Room",
    "RoomType",
    "Day",
    "Period",
    "TeacherSubject",
    "ClassSubjectRequirement",
    "Constraint",
    "ConstraintType",
    "ConstraintSeverity",
    "Timetable",
    "TimetableEntry",
    "TimetableStatus",
]
