"""Subject model."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_subject_name"),
        UniqueConstraint("tenant_id", "code", name="uq_tenant_subject_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    # Lab subjects (Physics Lab, Computer Science, etc.) must be scheduled in lab rooms
    is_lab: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Subject id={self.id} name={self.name!r}>"
