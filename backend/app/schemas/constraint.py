"""Pydantic schemas for the `/api/constraints` CRUD + parse endpoints."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConstraintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    constraint_type: str
    raw_text: str
    payload: dict
    severity: str
    weight: float
    is_active: bool
    created_at: datetime
    description: str | None = None  # human-readable, filled in by the router


class ConstraintUpdate(BaseModel):
    severity: str | None = Field(default=None, pattern="^(hard|soft)$")
    weight: float | None = Field(default=None, ge=0.1, le=20.0)
    is_active: bool | None = None


class ConversationTurn(BaseModel):
    """One prior turn in the chat, sent back on every /parse call so the LLM
    can resolve follow-ups ("Kiran Rao" answering a prior "which Rao?"
    question) without the admin having to restate the whole original
    sentence. The backend is otherwise stateless - the frontend owns the
    thread and replays it each time."""

    role: str = Field(..., pattern="^(user|assistant)$")
    text: str


class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    history: list[ConversationTurn] = Field(
        default_factory=list, description="Prior turns in this chat, oldest first, for follow-up context"
    )


class ParseResponse(BaseModel):
    """What the frontend's confirm/edit/reject card is built from."""

    status: str  # resolved | clarification_needed | unparseable | llm_error
    raw_text: str
    constraint_type: str | None = None
    severity: str | None = None
    weight: float | None = None
    payload: dict | None = None
    llm_explanation: str | None = None  # the LLM's own paraphrase
    human_description: str | None = None  # generated from the resolved (id-based) payload
    clarification_question: str | None = None
    candidates: list[str] = Field(default_factory=list)
    error_message: str | None = None


class ConfirmRequest(BaseModel):
    """Body for saving a constraint the admin has confirmed (optionally
    edited) from a prior `/parse` response."""

    constraint_type: str
    raw_text: str
    payload: dict
    severity: str = Field(default="hard", pattern="^(hard|soft)$")
    weight: float = Field(default=1.0, ge=0.1, le=20.0)
