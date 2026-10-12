"""Timetable (a generated version) and its entries."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TimetableStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class Timetable(Base):
    __tablename__ = "timetables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[TimetableStatus] = mapped_column(
        Enum(TimetableStatus, native_enum=False, length=20, values_callable=lambda ec: [e.value for e in ec]),
        default=TimetableStatus.DRAFT,
        nullable=False,
    )
    # Solver objective value (lower = fewer soft-constraint violations), null until solved
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Human-readable explanation: success summary, or conflict explanation on failure
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="timetable", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Timetable id={self.id} status={self.status} score={self.score}>"


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timetable_id: Mapped[int] = mapped_column(ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    day_id: Mapped[int] = mapped_column(ForeignKey("days.id", ondelete="CASCADE"), nullable=False)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)

    timetable: Mapped["Timetable"] = relationship(back_populates="entries")
    school_class: Mapped["SchoolClass"] = relationship()
    day: Mapped["Day"] = relationship()
    period: Mapped["Period"] = relationship()
    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
    room: Mapped["Room"] = relationship()

    def __repr__(self) -> str:
        return (
            f"<TimetableEntry timetable_id={self.timetable_id} class_id={self.class_id} "
            f"day_id={self.day_id} period_id={self.period_id}>"
        )
