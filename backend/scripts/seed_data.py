"""
Seed the database with the same sample data as `database/seed.sql`, using
the SQLAlchemy ORM. Handy for local dev/tests when you don't want to
switch to phpMyAdmin, and used by the pytest fixtures in `backend/tests`.

Run from the `backend/` directory:
    python scripts/seed_data.py

This is destructive-but-safe: it clears the tables it seeds (in FK-safe
order) before re-inserting, so it can be re-run freely.
"""
import sys
from datetime import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.db.session import Base, SessionLocal, engine
from app import models  # noqa: F401
from app.models.class_subject_requirement import ClassSubjectRequirement
from app.models.day import Day
from app.models.period import Period
from app.models.room import Room, RoomType
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject

DAYS = [
    ("Monday", 1), ("Tuesday", 2), ("Wednesday", 3),
    ("Thursday", 4), ("Friday", 5), ("Saturday", 6),
]

# (period_number, start, end, is_break, label)
PERIODS = [
    (1, time(8, 0), time(8, 40), False, "Period 1"),
    (2, time(8, 40), time(9, 20), False, "Period 2"),
    (3, time(9, 20), time(10, 0), False, "Period 3"),
    (4, time(10, 0), time(10, 40), False, "Period 4"),
    (9, time(10, 40), time(11, 10), True, "Lunch Break"),
    (5, time(11, 10), time(11, 50), False, "Period 5"),
    (6, time(11, 50), time(12, 30), False, "Period 6"),
    (7, time(12, 30), time(13, 10), False, "Period 7"),
    (8, time(13, 10), time(13, 50), False, "Period 8"),
]

# (name, code, is_lab)
SUBJECTS = [
    ("English", "ENG", False),
    ("Hindi", "HIN", False),
    ("Mathematics", "MATH", False),
    ("Science", "SCI", True),
    ("Social Studies", "SST", False),
    ("Computer Science", "CS", True),
    ("Physical Education", "PE", False),
    ("Art & Craft", "ART", False),
    ("Sanskrit", "SANS", False),
    ("General Knowledge", "GK", False),
]

PERIODS_PER_WEEK = {
    "MATH": 6, "SCI": 6, "ENG": 5, "HIN": 4, "SST": 4,
    "CS": 3, "PE": 3, "ART": 2, "SANS": 3, "GK": 2,
}

# (grade, section, strength)
CLASSES = [
    (6, "A", 42), (6, "B", 40),
    (7, "A", 44), (7, "B", 41),
    (8, "A", 39), (8, "B", 43),
    (9, "A", 40), (9, "B", 38),
    (10, "A", 36), (10, "B", 37),
]

# (name, room_type, capacity)
ROOMS = [
    ("Room-101", RoomType.CLASSROOM, 45), ("Room-102", RoomType.CLASSROOM, 45),
    ("Room-103", RoomType.CLASSROOM, 45), ("Room-104", RoomType.CLASSROOM, 45),
    ("Room-105", RoomType.CLASSROOM, 45), ("Room-106", RoomType.CLASSROOM, 45),
    ("Room-107", RoomType.CLASSROOM, 45), ("Room-108", RoomType.CLASSROOM, 45),
    ("Room-109", RoomType.CLASSROOM, 45), ("Room-110", RoomType.CLASSROOM, 45),
    ("Computer Lab 1", RoomType.LAB, 35), ("Computer Lab 2", RoomType.LAB, 35),
    ("Science Lab 1", RoomType.LAB, 30), ("Science Lab 2", RoomType.LAB, 30),
]

# (name, email, phone)
TEACHERS = [
    ("Anita Sharma", "anita.sharma@school.edu", "9800000001"),
    ("Ramesh Gupta", "ramesh.gupta@school.edu", "9800000002"),
    ("Priya Nair", "priya.nair@school.edu", "9800000003"),
    ("Suresh Iyer", "suresh.iyer@school.edu", "9800000004"),
    ("Kavita Rao", "kavita.rao@school.edu", "9800000005"),
    ("Manoj Verma", "manoj.verma@school.edu", "9800000006"),
    ("Deepa Menon", "deepa.menon@school.edu", "9800000007"),
    ("Arjun Reddy", "arjun.reddy@school.edu", "9800000008"),
    ("Sneha Kulkarni", "sneha.kulkarni@school.edu", "9800000009"),
    ("Vikram Singh", "vikram.singh@school.edu", "9800000010"),
    ("Pooja Joshi", "pooja.joshi@school.edu", "9800000011"),
    ("Rajesh Pillai", "rajesh.pillai@school.edu", "9800000012"),
    ("Neha Desai", "neha.desai@school.edu", "9800000013"),
    ("Amit Kapoor", "amit.kapoor@school.edu", "9800000014"),
    ("Divya Krishnan", "divya.krishnan@school.edu", "9800000015"),
    ("Sanjay Mehta", "sanjay.mehta@school.edu", "9800000016"),
    ("Lakshmi Pillai", "lakshmi.pillai@school.edu", "9800000017"),
    ("Rohit Bhatt", "rohit.bhatt@school.edu", "9800000018"),
    ("Meera Iyengar", "meera.iyengar@school.edu", "9800000019"),
    ("Kiran Rao", "kiran.rao@school.edu", "9800000020"),
]

# teacher name -> list of subject codes they are qualified to teach
TEACHER_QUALIFICATIONS = {
    "Anita Sharma": ["MATH"],
    "Ramesh Gupta": ["MATH"],
    "Priya Nair": ["MATH"],
    "Suresh Iyer": ["SCI"],
    "Kavita Rao": ["SCI"],
    "Manoj Verma": ["SCI"],
    "Deepa Menon": ["ENG"],
    "Arjun Reddy": ["ENG"],
    "Sneha Kulkarni": ["ENG"],
    "Vikram Singh": ["HIN"],
    "Pooja Joshi": ["HIN"],
    "Rajesh Pillai": ["SST"],
    "Neha Desai": ["SST"],
    "Amit Kapoor": ["CS"],
    "Divya Krishnan": ["CS"],
    "Sanjay Mehta": ["PE"],
    "Lakshmi Pillai": ["PE"],
    "Rohit Bhatt": ["ART", "GK"],
    "Meera Iyengar": ["ART", "SANS"],
    "Kiran Rao": ["SANS", "GK"],
}

# (grade, section) -> homeroom/class teacher name. Administrative metadata
# only - not used by the solver.
CLASS_TEACHERS = {
    (6, "A"): "Anita Sharma",
    (6, "B"): "Deepa Menon",
    (7, "A"): "Suresh Iyer",
    (7, "B"): "Vikram Singh",
    (8, "A"): "Rajesh Pillai",
    (8, "B"): "Kavita Rao",
    (9, "A"): "Sanjay Mehta",
    (9, "B"): "Meera Iyengar",
    (10, "A"): "Priya Nair",
    (10, "B"): "Arjun Reddy",
}


def clear_tables(db) -> None:
    """Delete in FK-safe order (children before parents), then reset
    AUTO_INCREMENT so re-running this script always produces the same ids
    as a fresh `database/seed.sql` import (that file uses TRUNCATE, which
    resets the counter automatically; plain DELETE does not)."""
    tables_in_fk_order = [
        ClassSubjectRequirement, TeacherSubject, Period, Day, Room,
        SchoolClass, Subject, Teacher,
    ]
    for model in tables_in_fk_order:
        db.query(model).delete()
    db.commit()
    for model in tables_in_fk_order:
        db.execute(text(f"ALTER TABLE {model.__tablename__} AUTO_INCREMENT = 1"))
    db.commit()


def seed() -> None:
    Base.metadata.create_all(bind=engine)  # make sure tables exist
    db = SessionLocal()
    try:
        clear_tables(db)

        days = {name: Day(name=name, order_index=idx) for name, idx in DAYS}
        db.add_all(days.values())

        periods = [
            Period(period_number=num, start_time=start, end_time=end, is_break=is_break, label=label)
            for num, start, end, is_break, label in PERIODS
        ]
        db.add_all(periods)

        subjects = {code: Subject(name=name, code=code, is_lab=is_lab) for name, code, is_lab in SUBJECTS}
        db.add_all(subjects.values())

        classes = [SchoolClass(grade=grade, section=section, strength=strength) for grade, section, strength in CLASSES]
        classes_by_grade_section = {(c.grade, c.section): c for c in classes}
        db.add_all(classes)

        rooms = [Room(name=name, room_type=room_type, capacity=capacity) for name, room_type, capacity in ROOMS]
        db.add_all(rooms)

        teachers = {name: Teacher(name=name, email=email, phone=phone) for name, email, phone in TEACHERS}
        db.add_all(teachers.values())

        db.flush()  # assign IDs without committing yet

        # teacher_subjects
        for teacher_name, subject_codes in TEACHER_QUALIFICATIONS.items():
            for code in subject_codes:
                db.add(TeacherSubject(teacher_id=teachers[teacher_name].id, subject_id=subjects[code].id))

        # class_subject_requirements: same load applied to every class
        for school_class in classes:
            for code, ppw in PERIODS_PER_WEEK.items():
                db.add(
                    ClassSubjectRequirement(
                        class_id=school_class.id, subject_id=subjects[code].id, periods_per_week=ppw
                    )
                )

        # class_teacher assignments (homeroom teacher per class)
        for (grade, section), teacher_name in CLASS_TEACHERS.items():
            school_class = classes_by_grade_section.get((grade, section))
            teacher = teachers.get(teacher_name)
            if school_class and teacher:
                school_class.class_teacher_id = teacher.id

        db.commit()
        print(
            f"Seeded: {len(days)} days, {len(periods)} periods, {len(subjects)} subjects, "
            f"{len(classes)} classes, {len(rooms)} rooms, {len(teachers)} teachers, "
            f"{sum(len(v) for v in TEACHER_QUALIFICATIONS.values())} teacher-subject links, "
            f"{len(classes) * len(PERIODS_PER_WEEK)} class-subject requirements."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
