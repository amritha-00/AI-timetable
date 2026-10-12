"""
Top-level orchestration for turning one English sentence into either a
resolved, DB-ready constraint or a clarification question.

This is the only function `app/routers/constraints.py` calls into.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.llm.base import LLMError, LLMProvider
from app.llm.entity_catalog import load_school_entities
from app.llm.prompts import build_system_prompt
from app.llm.provider_factory import get_llm_provider
from app.llm.resolver import ResolvedConstraint, resolve_constraint
from app.schemas.constraint import ConversationTurn
from app.schemas.constraint_types import ClarificationNeeded, LLMConstraintResponse

ParseStatus = Literal["resolved", "clarification_needed", "unparseable", "llm_error"]


@dataclass
class ParseOutcome:
    status: ParseStatus
    raw_text: str
    resolved: ResolvedConstraint | None = None
    clarification: ClarificationNeeded | None = None
    error_message: str | None = None


def _build_conversational_message(raw_text: str, history: list[ConversationTurn]) -> str:
    """
    Folds prior turns into the single user-message string every provider
    already accepts, rather than threading a real multi-turn messages array
    through all four provider implementations. An LLM handles a clearly
    labeled "conversation so far" block just as well as a native multi-turn
    array for a thread this short, and it keeps every provider's plumbing
    (and the `LLMProvider` interface itself) untouched.
    """
    if not history:
        return raw_text

    lines = ["Conversation so far (oldest first):"]
    for turn in history:
        speaker = "Admin" if turn.role == "user" else "You (assistant)"
        lines.append(f"{speaker}: {turn.text}")
    lines.append("")
    lines.append(f"Admin's latest message, which you must now interpret: {raw_text}")
    lines.append(
        "If your previous turn asked a question, treat this latest message as the answer to it - "
        "resolve pronouns, short replies (like just a name), and confirmations using that context."
    )
    return "\n".join(lines)


def parse_constraint_text(
    db: Session,
    raw_text: str,
    tenant_id: int,
    history: list[ConversationTurn] | None = None,
    provider: LLMProvider | None = None,
) -> ParseOutcome:
    raw_text = raw_text.strip()
    if not raw_text:
        return ParseOutcome(status="unparseable", raw_text=raw_text, error_message="Please enter a sentence.")
    history = history or []

    try:
        # Constructing a provider can itself fail fast (e.g. a missing API
        # key raises immediately in __init__, before any network call) -
        # that has to go through the same graceful-error path as a failed
        # API call, not propagate as an unhandled 500.
        provider = provider or get_llm_provider()
    except LLMError as exc:
        return ParseOutcome(status="llm_error", raw_text=raw_text, error_message=str(exc))

    entities = load_school_entities(db, tenant_id)
    system_prompt = build_system_prompt(entities)
    schema = LLMConstraintResponse.model_json_schema()
    conversational_message = _build_conversational_message(raw_text, history)
    # Vague-phrase ("morning"/"afternoon") fallback in the resolver should see
    # the whole thread, not just a short follow-up reply like "Kiran Rao" -
    # otherwise a phrase stated two turns ago would be invisible to it.
    fallback_scan_text = " ".join([t.text for t in history] + [raw_text])

    try:
        raw_json = provider.complete_structured(
            system_prompt=system_prompt,
            user_message=conversational_message,
            json_schema=schema,
            schema_name="constraint extraction result",
        )
    except LLMError as exc:
        return ParseOutcome(status="llm_error", raw_text=raw_text, error_message=str(exc))

    try:
        response = LLMConstraintResponse.model_validate(raw_json)
    except ValidationError as exc:
        return ParseOutcome(
            status="llm_error",
            raw_text=raw_text,
            error_message=f"The model's response didn't match the expected format: {exc.error_count()} "
            f"validation error(s). Try rephrasing the sentence.",
        )

    if response.result == "unparseable":
        return ParseOutcome(
            status="unparseable",
            raw_text=raw_text,
            error_message=response.error_message or "This doesn't look like a schedulable constraint.",
        )

    if response.result == "clarification_needed":
        clarification = response.clarification or ClarificationNeeded(
            clarification_question="Could you provide more detail?"
        )
        return ParseOutcome(status="clarification_needed", raw_text=raw_text, clarification=clarification)

    # result == "parsed"
    if response.parsed is None:
        return ParseOutcome(
            status="llm_error", raw_text=raw_text,
            error_message="The model reported success but didn't include a parsed constraint.",
        )

    outcome = resolve_constraint(entities, response.parsed, fallback_scan_text)
    if isinstance(outcome, ClarificationNeeded):
        return ParseOutcome(status="clarification_needed", raw_text=raw_text, clarification=outcome)
    return ParseOutcome(status="resolved", raw_text=raw_text, resolved=outcome)
