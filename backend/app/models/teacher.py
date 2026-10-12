"""Teacher model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_tenant_teacher_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Soft-constraint helper: max periods this teacher should teach per day
    max_periods_per_day: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan"
    )

    @property
    def subject_ids(self) -> list[int]:
        """Subject ids this teacher is qualified to teach - read via the
        `teacher_subjects` relationship, so eager-load it (selectinload) in
        any query that will serialize this to avoid N+1 lookups."""
        return [ts.subject_id for ts in self.teacher_subjects]

    def __repr__(self) -> str:
        return f"<Teacher id={self.id} name={self.name!r}>"
