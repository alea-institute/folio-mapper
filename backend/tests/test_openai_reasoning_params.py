"""Regression tests: OpenAI reasoning models reject `max_tokens` and non-default
`temperature`. The OpenAICompatProvider must translate params for them.

Reasoning models (o-series, gpt-5 family) require `max_completion_tokens` instead
of `max_tokens` and only accept the default temperature (1). Sending the wrong
params yields a 400 from OpenAI, which surfaced in the UI as "Invalid".
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm.openai_compat import OpenAICompatProvider


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _mock_client_capturing_create():
    """Return (mock_client, calls) where calls collects kwargs of each create()."""
    calls: list[dict] = []

    async def fake_create(**kwargs):
        calls.append(kwargs)
        choice = MagicMock()
        choice.message.content = "ok"
        resp = MagicMock()
        resp.choices = [choice]
        return resp

    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=fake_create)
    client.models.list = AsyncMock(return_value=MagicMock(data=[]))
    return client, calls


@pytest.mark.anyio
@pytest.mark.parametrize("model", ["o4-mini", "o3", "o3-mini", "gpt-5.5", "gpt-5", "gpt-5.2-pro"])
async def test_reasoning_model_test_connection_uses_max_completion_tokens(model):
    client, calls = _mock_client_capturing_create()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OpenAICompatProvider(api_key="sk-test", base_url="https://api.openai.com/v1", model=model)
        assert await provider.test_connection() is True

    assert len(calls) == 1
    kwargs = calls[0]
    assert "max_tokens" not in kwargs, f"{model}: max_tokens must not be sent to reasoning models"
    assert "max_completion_tokens" in kwargs, f"{model}: must send max_completion_tokens"


@pytest.mark.anyio
@pytest.mark.parametrize("model", ["o4-mini", "gpt-5.5"])
async def test_reasoning_model_complete_translates_params(model):
    client, calls = _mock_client_capturing_create()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OpenAICompatProvider(api_key="sk-test", base_url="https://api.openai.com/v1", model=model)
        out = await provider.complete(
            [{"role": "user", "content": "hi"}],
            temperature=0.1,
            max_tokens=2048,
        )
    assert out == "ok"
    kwargs = calls[0]
    assert "max_tokens" not in kwargs
    assert kwargs.get("max_completion_tokens") == 2048
    # Non-default temperature must be dropped (reasoning models only allow 1)
    assert kwargs.get("temperature", 1) == 1


@pytest.mark.anyio
async def test_non_reasoning_model_keeps_max_tokens_and_temperature():
    client, calls = _mock_client_capturing_create()
    with patch("openai.AsyncOpenAI", return_value=client):
        provider = OpenAICompatProvider(api_key="sk-test", base_url="https://api.openai.com/v1", model="gpt-4o")
        await provider.complete(
            [{"role": "user", "content": "hi"}],
            temperature=0.1,
            max_tokens=2048,
        )
    kwargs = calls[0]
    assert kwargs.get("max_tokens") == 2048
    assert "max_completion_tokens" not in kwargs
    assert kwargs.get("temperature") == 0.1
