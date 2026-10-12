"""Pydantic schemas for Room CRUD."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.room import RoomType


class RoomBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    room_type: RoomType = RoomType.CLASSROOM
    capacity: int = Field(default=40, ge=1, le=500)


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    room_type: RoomType | None = None
    capacity: int | None = Field(default=None, ge=1, le=500)


class RoomOut(RoomBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
