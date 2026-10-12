"""Pydantic schemas for SchoolClass (grade + section) CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SchoolClassBase(BaseModel):
    grade: int = Field(..., ge=1, le=12)
    section: str = Field(..., min_length=1, max_length=5)
    strength: int = Field(default=40, ge=1, le=200)
    class_teacher_id: int | None = Field(default=None, description="The homeroom/class teacher, if assigned")


class SchoolClassCreate(SchoolClassBase):
    pass


class SchoolClassUpdate(BaseModel):
    grade: int | None = Field(default=None, ge=1, le=12)
    section: str | None = Field(default=None, min_length=1, max_length=5)
    strength: int | None = Field(default=None, ge=1, le=200)
    class_teacher_id: int | None = Field(default=None)


class SchoolClassOut(SchoolClassBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_name: str
    class_teacher_name: str | None = None
