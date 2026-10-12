"""Anthropic Claude provider, using tool-use to force structured JSON output."""
from __future__ import annotations

import json
from typing import Any

import anthropic

from app.config import settings
from app.llm.base import LLMError, LLMProvider

_TOOL_NAME = "submit_result"


class AnthropicProvider(LLMProvider):
    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise LLMError(
                "ANTHROPIC_API_KEY is not set in .env. Get a key from https://console.anthropic.com/ "
                "and set LLM_PROVIDER=anthropic (or switch to LLM_PROVIDER=bedrock)."
            )
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model

    def complete_structured(
        self, system_prompt: str, user_message: str, json_schema: dict[str, Any], schema_name: str
    ) -> dict[str, Any]:
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                tools=[
                    {
                        "name": _TOOL_NAME,
                        "description": f"Submit the extracted {schema_name} result.",
                        "input_schema": json_schema,
                    }
                ],
                tool_choice={"type": "tool", "name": _TOOL_NAME},
            )
        except anthropic.APIError as exc:
            raise LLMError(f"Anthropic API error: {exc}") from exc

        for block in response.content:
            if block.type == "tool_use" and block.name == _TOOL_NAME:
                return block.input  # already a dict, decoded by the SDK

        raise LLMError("Anthropic response did not include the expected tool call.")

    def complete_text(self, system_prompt: str, user_message: str) -> str:
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=512,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
        except anthropic.APIError as exc:
            raise LLMError(f"Anthropic API error: {exc}") from exc

        text_blocks = [b.text for b in response.content if b.type == "text"]
        if not text_blocks:
            raise LLMError("Anthropic response contained no text.")
        return "\n".join(text_blocks).strip()
