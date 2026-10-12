"""Tenant model - one row per signed-up school. This is a single-tenant-per-
login design (no separate `users` table): the school itself logs in with an
email + password, and every other table is scoped to `tenant_id`."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

#: How many timetable generations a tenant gets before the paywall kicks in.
FREE_TRIAL_GENERATIONS = 3


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Mock billing only - no real payment processor. Flipped by POST /api/auth/upgrade.
    is_subscribed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trial_generations_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    @property
    def trial_generations_remaining(self) -> int:
        return max(0, FREE_TRIAL_GENERATIONS - self.trial_generations_used)

    @property
    def can_generate(self) -> bool:
        return self.is_subscribed or self.trial_generations_remaining > 0

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} school_name={self.school_name!r}>"
