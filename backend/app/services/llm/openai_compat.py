"""OpenAI-compatible provider. Covers OpenAI, Mistral, Meta Llama, Ollama, LM Studio, Custom."""

import re

import openai

from app.models.llm_models import ModelInfo
from app.services.llm.base import BaseLLMProvider

# OpenAI reasoning models (o-series and the gpt-5 family) reject the `max_tokens`
# parameter — they require `max_completion_tokens` — and only accept the default
# temperature (1). Detect them by id so we can translate params before sending.
_REASONING_MODEL_RE = re.compile(r"^(o\d|gpt-?5)", re.IGNORECASE)


def _is_reasoning_model(model: str | None) -> bool:
    if not model:
        return False
    # Strip any provider prefix (e.g. "openai/gpt-5.5" -> "gpt-5.5").
    name = model.split("/")[-1].strip()
    return bool(_REASONING_MODEL_RE.match(name))


def _normalize_kwargs(model: str | None, kwargs: dict) -> dict:
    """Translate chat-completion kwargs for OpenAI reasoning models.

    - rename `max_tokens` -> `max_completion_tokens`
    - drop non-default `temperature` (reasoning models only allow the default of 1)
    """
    if not _is_reasoning_model(model):
        return kwargs
    out = dict(kwargs)
    if "max_tokens" in out:
        out.setdefault("max_completion_tokens", out.pop("max_tokens"))
    if out.get("temperature") not in (None, 1):
        out.pop("temperature", None)
    return out


class OpenAICompatProvider(BaseLLMProvider):
    """Provider for any OpenAI-compatible API."""

    async def test_connection(self) -> bool:
        client = openai.AsyncOpenAI(api_key=self.api_key or "unused", base_url=self.base_url)
        if self.model:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hi"}],
                **_normalize_kwargs(self.model, {"max_tokens": 1}),
            )
            return bool(resp.choices)
        else:
            await client.models.list()
            return True

    async def list_models(self) -> list[ModelInfo]:
        client = openai.AsyncOpenAI(api_key=self.api_key or "unused", base_url=self.base_url)
        resp = await client.models.list()
        return [
            ModelInfo(id=m.id, name=m.id)
            for m in sorted(resp.data, key=lambda m: m.id)
        ]

    async def complete(self, messages: list[dict], **kwargs) -> str:
        if not self.model:
            raise ValueError("No model selected")
        client = openai.AsyncOpenAI(api_key=self.api_key or "unused", base_url=self.base_url)
        resp = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            **_normalize_kwargs(self.model, kwargs),
        )
        return resp.choices[0].message.content or ""
