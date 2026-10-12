"""Pydantic schemas for Subject CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    is_lab: bool = False


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    is_lab: bool | None = None


class SubjectOut(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
