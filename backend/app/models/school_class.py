"""
School class model (e.g. "Grade 10 - A").

Named `school_class` / `SchoolClass` to avoid clashing with the Python
`class` keyword and to keep the table name unambiguous (`classes`).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.teacher import Teacher


class SchoolClass(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("tenant_id", "grade", "section", name="uq_tenant_grade_section"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String(5), nullable=False)
    # e.g. 45 students - used only for display/reference, not scheduling logic
    strength: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    # The homeroom/class teacher - administrative metadata (attendance,
    # discipline, parent contact point). Not used by the solver: it doesn't
    # imply anything about which periods that teacher teaches this class -
    # use a subject_time_preference constraint for that if needed.
    class_teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True
    )

    class_teacher: Mapped["Teacher"] = relationship(foreign_keys=[class_teacher_id])
    requirements: Mapped[list["ClassSubjectRequirement"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )

    @property
    def display_name(self) -> str:
        return f"Grade {self.grade} - {self.section}"

    @property
    def class_teacher_name(self) -> str | None:
        return self.class_teacher.name if self.class_teacher else None

    def __repr__(self) -> str:
        return f"<SchoolClass id={self.id} name={self.display_name!r}>"
