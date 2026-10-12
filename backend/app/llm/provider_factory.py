"""Picks the configured LLM provider. This is the single switch point -
nothing else in the app should import a concrete provider class directly."""
from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.llm.base import LLMError, LLMProvider

_PROVIDER_PACKAGES = {
    "anthropic": ("anthropic", "anthropic"),
    "bedrock": ("bedrock", "boto3"),
    "gemini": ("gemini", "google-genai"),
}


@lru_cache
def get_llm_provider() -> LLMProvider:
    try:
        if settings.llm_provider == "anthropic":
            from app.llm.anthropic_provider import AnthropicProvider

            return AnthropicProvider()
        if settings.llm_provider == "bedrock":
            from app.llm.bedrock_provider import BedrockProvider

            return BedrockProvider()
        if settings.llm_provider == "gemini":
            from app.llm.gemini_provider import GeminiProvider

            return GeminiProvider()
        if settings.llm_provider == "mock":
            from app.llm.mock_provider import MockProvider

            return MockProvider()
    except ImportError as exc:
        # A missing/broken dependency for the selected provider must degrade
        # into the same graceful error path as a bad API key or a network
        # failure - never an unhandled 500. This is especially easy to hit
        # if the app is ever run with an interpreter other than the
        # project's own backend/.venv (e.g. a global Python that has some
        # but not all of requirements.txt installed).
        package = _PROVIDER_PACKAGES.get(settings.llm_provider, (settings.llm_provider, settings.llm_provider))[1]
        raise LLMError(
            f"The '{settings.llm_provider}' LLM provider's package isn't installed in the Python "
            f"environment currently running this app ({exc}). Install it with: "
            f"pip install {package} - and make sure you're running the app from backend/.venv, "
            f"not a different Python interpreter."
        ) from exc

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")
