"""Join table: which teacher can teach which subject."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id", name="uq_teacher_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    teacher: Mapped["Teacher"] = relationship(back_populates="teacher_subjects")
    subject: Mapped["Subject"] = relationship(back_populates="teacher_subjects")

    def __repr__(self) -> str:
        return f"<TeacherSubject teacher_id={self.teacher_id} subject_id={self.subject_id}>"
