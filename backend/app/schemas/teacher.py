"""Pydantic schemas for Teacher CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TeacherBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    max_periods_per_day: int = Field(default=6, ge=1, le=10)
    is_active: bool = True


class TeacherCreate(TeacherBase):
    pass


class TeacherUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    max_periods_per_day: int | None = Field(default=None, ge=1, le=10)
    is_active: bool | None = None


class TeacherOut(TeacherBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    # Subject ids this teacher is qualified to teach - included directly here
    # (rather than requiring a separate GET .../subjects call per teacher) so
    # the frontend can render a full teacher x subject matrix in one request.
    subject_ids: list[int] = Field(default_factory=list)


class TeacherSubjectAssign(BaseModel):
    """Body for assigning a list of subjects a teacher is qualified to teach."""
    subject_ids: list[int]
