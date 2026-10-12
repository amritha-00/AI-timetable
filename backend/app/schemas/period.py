"""Pydantic schemas for Period CRUD."""
from __future__ import annotations

from datetime import time

from pydantic import BaseModel, ConfigDict, Field


class PeriodBase(BaseModel):
    period_number: int = Field(..., ge=1, le=15)
    start_time: time
    end_time: time
    is_break: bool = False
    label: str | None = Field(default=None, max_length=100)


class PeriodCreate(PeriodBase):
    pass


class PeriodUpdate(BaseModel):
    period_number: int | None = Field(default=None, ge=1, le=15)
    start_time: time | None = None
    end_time: time | None = None
    is_break: bool | None = None
    label: str | None = Field(default=None, max_length=100)


class PeriodOut(PeriodBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
