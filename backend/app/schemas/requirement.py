"""Pydantic schemas for ClassSubjectRequirement CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RequirementBase(BaseModel):
    class_id: int
    subject_id: int
    periods_per_week: int = Field(..., ge=1, le=20)
    teacher_id: int | None = Field(
        default=None, description="Pin a specific teacher to this class+subject; null = any qualified teacher"
    )


class RequirementCreate(RequirementBase):
    pass


class RequirementUpdate(BaseModel):
    periods_per_week: int | None = Field(default=None, ge=1, le=20)
    # Sent explicitly as `null` by the frontend to unpin a teacher (distinct
    # from omitting the field, which leaves the current pin untouched -
    # `exclude_unset` in the router tells the two apart).
    teacher_id: int | None = Field(default=None)


class RequirementOut(RequirementBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    teacher_name: str | None = None
