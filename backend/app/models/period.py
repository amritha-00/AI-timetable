"""Period (timeslot) model."""
from __future__ import annotations

from datetime import time as dt_time

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Period(Base):
    __tablename__ = "periods"
    __table_args__ = (UniqueConstraint("tenant_id", "period_number", name="uq_tenant_period_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    period_number: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[dt_time] = mapped_column(Time, nullable=False)
    end_time: Mapped[dt_time] = mapped_column(Time, nullable=False)
    # Break/lunch periods are never scheduled with classes
    is_break: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Lunch Break"

    def __repr__(self) -> str:
        return f"<Period id={self.id} number={self.period_number} break={self.is_break}>"
