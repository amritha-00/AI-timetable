"""AWS Bedrock provider (Amazon Nova), using the Converse API's tool-use
support to force structured JSON output. Same external contract as
`AnthropicProvider` - the rest of the app can't tell them apart."""
from __future__ import annotations

from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.llm.base import LLMError, LLMProvider

_TOOL_NAME = "submit_result"


class BedrockProvider(LLMProvider):
    def __init__(self) -> None:
        if not settings.aws_access_key_id or not settings.aws_secret_access_key:
            raise LLMError(
                "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set in .env. Configure AWS credentials "
                "with Bedrock access and set LLM_PROVIDER=bedrock (or switch to LLM_PROVIDER=anthropic)."
            )
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        self._model_id = settings.bedrock_model_id

    def complete_structured(
        self, system_prompt: str, user_message: str, json_schema: dict[str, Any], schema_name: str
    ) -> dict[str, Any]:
        try:
            response = self._client.converse(
                modelId=self._model_id,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_message}]}],
                toolConfig={
                    "tools": [
                        {
                            "toolSpec": {
                                "name": _TOOL_NAME,
                                "description": f"Submit the extracted {schema_name} result.",
                                "inputSchema": {"json": json_schema},
                            }
                        }
                    ],
                    # "any" forces the model to call a tool; since only one is
                    # offered, that's an effective forced call - Nova's Converse
                    # support for forcing a *specific* tool name varies by model
                    # version, so "any" is the more portable choice.
                    "toolChoice": {"any": {}},
                },
                inferenceConfig={"maxTokens": 1024},
            )
        except (ClientError, BotoCoreError) as exc:
            raise LLMError(f"Bedrock API error: {exc}") from exc

        content = response.get("output", {}).get("message", {}).get("content", [])
        for block in content:
            if "toolUse" in block and block["toolUse"].get("name") == _TOOL_NAME:
                return block["toolUse"]["input"]

        raise LLMError("Bedrock response did not include the expected tool call.")

    def complete_text(self, system_prompt: str, user_message: str) -> str:
        try:
            response = self._client.converse(
                modelId=self._model_id,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_message}]}],
                inferenceConfig={"maxTokens": 512},
            )
        except (ClientError, BotoCoreError) as exc:
            raise LLMError(f"Bedrock API error: {exc}") from exc

        content = response.get("output", {}).get("message", {}).get("content", [])
        text_blocks = [b["text"] for b in content if "text" in b]
        if not text_blocks:
            raise LLMError("Bedrock response contained no text.")
        return "\n".join(text_blocks).strip()
