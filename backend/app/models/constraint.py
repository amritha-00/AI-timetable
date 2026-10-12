"""
Constraint model.

Stores both the admin's original English sentence and the structured JSON
produced by the LLM layer (validated against the Pydantic schemas in
`app.schemas.constraint_types` before being saved here). The solver reads
only the structured `payload`, never the raw text.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, Integer, Text, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from sqlalchemy import ForeignKey

from app.db.session import Base


class ConstraintType(str, enum.Enum):
    TEACHER_UNAVAILABLE = "teacher_unavailable"
    TEACHER_PREFERRED_SLOT = "teacher_preferred_slot"
    SUBJECT_TIME_PREFERENCE = "subject_time_preference"
    MAX_PERIODS_PER_DAY = "max_periods_per_day"
    NO_CONSECUTIVE = "no_consecutive"
    ROOM_REQUIREMENT = "room_requirement"
    CLASS_TEACHER_PERIOD = "class_teacher_period"
    CLASS_SUBJECT_ASSIGNMENT = "class_subject_assignment"


class ConstraintSeverity(str, enum.Enum):
    HARD = "hard"
    SOFT = "soft"


class Constraint(Base):
    __tablename__ = "constraints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    constraint_type: Mapped[ConstraintType] = mapped_column(
        Enum(ConstraintType, native_enum=False, length=40, values_callable=lambda ec: [e.value for e in ec]),
        nullable=False,
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Validated structured constraint, e.g.
    # {"teacher_id": 3, "day_id": 5, "periods": [5,6,7,8]}
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    severity: Mapped[ConstraintSeverity] = mapped_column(
        Enum(ConstraintSeverity, native_enum=False, length=10, values_callable=lambda ec: [e.value for e in ec]),
        default=ConstraintSeverity.HARD,
        nullable=False,
    )
    # Only meaningful for soft constraints; higher = more important to the objective
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<Constraint id={self.id} type={self.constraint_type} active={self.is_active}>"
