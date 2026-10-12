"""
Common interface every LLM provider implements.

The rest of the app (parser, explainer, router) only ever talks to this
interface, so switching `LLM_PROVIDER` in `.env` between `anthropic` and
`bedrock` never requires touching any other code.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMError(Exception):
    """Raised when a provider fails to produce a usable structured response
    (network/auth error, or the model's output couldn't be parsed as the
    requested JSON schema after retries)."""


class LLMProvider(ABC):
    @abstractmethod
    def complete_structured(
        self,
        system_prompt: str,
        user_message: str,
        json_schema: dict[str, Any],
        schema_name: str,
    ) -> dict[str, Any]:
        """
        Ask the model to respond with JSON matching `json_schema` (a plain
        JSON-Schema dict, e.g. from `SomePydanticModel.model_json_schema()`).
        Returns the parsed JSON as a dict. Raises `LLMError` on failure.
        """

    @abstractmethod
    def complete_text(self, system_prompt: str, user_message: str) -> str:
        """Free-form text completion, used for plain-English explanations
        where a rigid schema isn't needed."""
