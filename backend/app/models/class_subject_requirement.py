"""How many periods per week a given subject needs for a given class, and
optionally *which* teacher covers it.

If `teacher_id` is left null, the solver picks freely from any teacher
qualified for the subject (`teacher_subjects`) - potentially a different
one for different periods, which keeps scheduling maximally flexible but
doesn't match how most real schools operate (one teacher usually owns a
class's Math periods for the whole term, say). Setting `teacher_id` pins
that specific teacher to every period of this (class, subject) - the
solver then treats it as a hard constraint, not a preference.
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ClassSubjectRequirement(Base):
    __tablename__ = "class_subject_requirements"
    __table_args__ = (UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    periods_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Pinned teacher for this class+subject - null means "any qualified teacher".
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True
    )

    school_class: Mapped["SchoolClass"] = relationship(back_populates="requirements")
    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["Teacher"] = relationship()

    @property
    def teacher_name(self) -> str | None:
        return self.teacher.name if self.teacher else None

    def __repr__(self) -> str:
        return (
            f"<ClassSubjectRequirement class_id={self.class_id} "
            f"subject_id={self.subject_id} periods_per_week={self.periods_per_week} "
            f"teacher_id={self.teacher_id}>"
        )
