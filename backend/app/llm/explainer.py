"""Turns a timetable's technical solver message into a plain-English
explanation for a non-technical school admin. Degrades gracefully: if the
LLM call fails (no API key configured, network error, etc.) it falls back
to returning the technical message as-is rather than breaking the page."""
from __future__ import annotations

from app.llm.base import LLMError, LLMProvider
from app.llm.prompts import build_explanation_prompt
from app.llm.provider_factory import get_llm_provider


def explain_timetable_message(technical_message: str, provider: LLMProvider | None = None) -> str:
    if not technical_message:
        return "No details are available for this timetable."

    try:
        provider = provider or get_llm_provider()
        prompt = build_explanation_prompt(technical_message)
        return provider.complete_text(
            system_prompt="You explain school timetable results in plain English for administrators.",
            user_message=prompt,
        )
    except LLMError:
        return technical_message
