"""
Google Gemini provider - a free-tier-friendly option (get a key at
https://aistudio.google.com/apikey, no credit card required).

Unlike the Anthropic/Bedrock providers, this does NOT use Gemini's strict
`response_schema` structured-output mode: that mode only supports a subset
of JSON Schema (roughly OpenAPI 3.0), and the discriminated-union schema
`LLMConstraintResponse` produces (via Pydantic's `$defs`/`oneOf`) doesn't fit
that subset cleanly. Instead this asks for JSON output via
`response_mime_type="application/json"` (which guarantees syntactically
valid JSON, just not a guaranteed-matching shape) and relies on the same
Pydantic validation every other provider's output already goes through in
`app/llm/parser.py`. That validation step is the real safety net for every
provider, not provider-side schema enforcement - so this is no less robust
in practice, just via a different mechanism.
"""
from __future__ import annotations

import json
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.config import settings
from app.llm.base import LLMError, LLMProvider


class GeminiProvider(LLMProvider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise LLMError(
                "GEMINI_API_KEY is not set in .env. Get a free key (no credit card) from "
                "https://aistudio.google.com/apikey and set LLM_PROVIDER=gemini."
            )
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model
        # Newer/larger Gemini models spend part of max_output_tokens on an
        # internal "thinking" pass before the visible answer; with a tight
        # budget that can eat the whole response and leave `response.text`
        # empty. This task needs no multi-step reasoning, so we ask to turn
        # thinking off - but Flash-Lite variants reject the `thinking_config`
        # field entirely (400 INVALID_ARGUMENT), since they have no thinking
        # mode to disable. Rather than hardcode a model-name check that the
        # next model rename would silently break, we just try with it once
        # and remember whether this model accepted it.
        self._supports_thinking_config: bool | None = None

    def _generate(self, config_kwargs: dict[str, Any]) -> genai_types.GenerateContentResponse:
        contents = config_kwargs.pop("contents")
        base_config = dict(config_kwargs)

        def _call(with_thinking: bool):
            cfg = dict(base_config)
            if with_thinking:
                cfg["thinking_config"] = genai_types.ThinkingConfig(thinking_budget=0)
            return self._client.models.generate_content(
                model=self._model, contents=contents, config=genai_types.GenerateContentConfig(**cfg)
            )

        if self._supports_thinking_config is False:
            return _call(with_thinking=False)
        try:
            response = _call(with_thinking=True)
            self._supports_thinking_config = True
            return response
        except genai_errors.APIError as exc:
            if self._supports_thinking_config is None and "INVALID_ARGUMENT" in str(exc):
                self._supports_thinking_config = False
                return _call(with_thinking=False)
            raise

    def complete_structured(
        self, system_prompt: str, user_message: str, json_schema: dict[str, Any], schema_name: str
    ) -> dict[str, Any]:
        # Embed the schema as a readable hint in the prompt itself, since we
        # deliberately don't pass it as a strict `response_schema` (see
        # module docstring). The system prompt's own worked examples already
        # do most of the work; this is a belt-and-braces addition.
        schema_hint = (
            f"\n\nRespond with ONLY a single JSON object (no markdown fences, no extra text) "
            f"matching this shape (a JSON Schema, for reference):\n{json.dumps(json_schema)}"
        )
        try:
            response = self._generate(
                {
                    "contents": user_message,
                    "system_instruction": system_prompt + schema_hint,
                    "response_mime_type": "application/json",
                    "max_output_tokens": 2048,
                }
            )
        except genai_errors.APIError as exc:
            raise LLMError(f"Gemini API error: {exc}") from exc

        text = response.text
        if not text:
            raise LLMError("Gemini response contained no text.")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"Gemini did not return valid JSON: {exc}") from exc

    def complete_text(self, system_prompt: str, user_message: str) -> str:
        try:
            response = self._generate(
                {"contents": user_message, "system_instruction": system_prompt, "max_output_tokens": 1024}
            )
        except genai_errors.APIError as exc:
            raise LLMError(f"Gemini API error: {exc}") from exc

        if not response.text:
            raise LLMError("Gemini response contained no text.")
        return response.text.strip()
