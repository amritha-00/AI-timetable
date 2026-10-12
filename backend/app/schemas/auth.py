"""Schemas for signup/login and the tenant's own account/billing state."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    school_name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    school_name: str
    email: str
    is_subscribed: bool
    trial_generations_used: int
    trial_generations_remaining: int
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant: TenantOut
