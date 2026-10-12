"""Pydantic schemas for timetable generation and viewing."""
from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class TimetableGenerateRequest(BaseModel):
    name: str = Field(default="Generated Timetable", min_length=1, max_length=150)
    time_limit_seconds: int | None = Field(default=None, ge=5, le=600)
    include_soft: bool = True


class TimetableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    status: str
    score: float | None
    message: str | None
    created_at: datetime


class MoveEntryRequest(BaseModel):
    """Body for a drag-and-drop move: reassign one entry to a different
    day/period. The room is kept if still free, or reassigned automatically
    from the same room-type pool; if none are free, the move is rejected."""
    day_id: int
    period_id: int


class TimetableEntryOut(BaseModel):
    """Denormalized entry - includes display names so the frontend doesn't
    need to join against every other endpoint just to render a grid."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    class_id: int
    class_name: str
    day_id: int
    day_name: str
    period_id: int
    period_number: int
    start_time: time
    end_time: time
    subject_id: int
    subject_name: str
    subject_is_lab: bool
    teacher_id: int
    teacher_name: str
    room_id: int
    room_name: str
