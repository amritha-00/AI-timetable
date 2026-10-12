"""Pydantic schemas for Day CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DayBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    order_index: int = Field(..., ge=1, le=7)


class DayCreate(DayBase):
    pass


class DayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    order_index: int | None = Field(default=None, ge=1, le=7)


class DayOut(DayBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
