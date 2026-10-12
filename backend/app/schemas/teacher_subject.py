"""Pydantic schemas for the teacher<->subject qualification join table."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class TeacherSubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    teacher_id: int
    subject_id: int
