"""Schemas for the platform-owner admin panel - not tenant-facing."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenantAdminOut(BaseModel):
    id: int
    school_name: str
    email: str
    is_subscribed: bool
    trial_generations_used: int
    trial_generations_remaining: int
    created_at: datetime
    teacher_count: int
    class_count: int
    timetable_count: int


class SetSubscriptionRequest(BaseModel):
    is_subscribed: bool
