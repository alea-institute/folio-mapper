"""Tests for the GET /api/llm/key-status endpoint and env var fallback."""

import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.llm_models import LLMProviderType
from app.services.llm.openai_compat import OpenAICompatProvider
from app.services.llm.registry import PROVIDER_ENV_VAR, get_provider


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# --- key-status endpoint tests ---


@pytest.mark.anyio
async def test_key_status_no_env_vars(client: AsyncClient):
    """With no env vars set, env_providers should be empty."""
    # Clear any that might be set in the test environment
    with patch.dict(os.environ, {v: "" for v in PROVIDER_ENV_VAR.values()}, clear=False):
        # Also need to remove them entirely (empty string still "exists" but is falsy)
        env_override = {v: "" for v in PROVIDER_ENV_VAR.values()}
        with patch.dict(os.environ, env_override, clear=False):
            resp = await client.get("/api/llm/key-status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["env_providers"] == []


@pytest.mark.anyio
async def test_key_status_with_openai_key(client: AsyncClient):
    """When OPENAI_API_KEY is set, it should appear in env_providers."""
    clean = {v: "" for v in PROVIDER_ENV_VAR.values()}
    clean["OPENAI_API_KEY"] = "sk-test-key"
    with patch.dict(os.environ, clean, clear=False):
        resp = await client.get("/api/llm/key-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "openai" in data["env_providers"]


@pytest.mark.anyio
async def test_key_status_multiple_providers(client: AsyncClient):
    """Multiple env vars should all appear."""
    clean = {v: "" for v in PROVIDER_ENV_VAR.values()}
    clean["OPENAI_API_KEY"] = "sk-test"
    clean["ANTHROPIC_API_KEY"] = "sk-ant-test"
    clean["GOOGLE_API_KEY"] = "AIza-test"
    with patch.dict(os.environ, clean, clear=False):
        resp = await client.get("/api/llm/key-status")
    assert resp.status_code == 200
    data = resp.json()
    assert set(data["env_providers"]) == {"openai", "anthropic", "google"}


@pytest.mark.anyio
async def test_key_status_never_leaks_key_values(client: AsyncClient):
    """The response must never contain actual key values."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-super-secret-key-12345"}, clear=False):
        resp = await client.get("/api/llm/key-status")
    data = resp.json()
    response_text = str(data)
    assert "sk-super-secret-key-12345" not in response_text


@pytest.mark.anyio
async def test_key_status_empty_string_not_counted(client: AsyncClient):
    """An empty string env var should not be reported as available."""
    clean = {v: "" for v in PROVIDER_ENV_VAR.values()}
    with patch.dict(os.environ, clean, clear=False):
        resp = await client.get("/api/llm/key-status")
    assert resp.status_code == 200
    assert resp.json()["env_providers"] == []


# --- get_provider env var fallback tests ---


def test_get_provider_env_fallback():
    """When no api_key is passed, get_provider should use env var."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-from-env"}):
        provider = get_provider(LLMProviderType.OPENAI)
    assert isinstance(provider, OpenAICompatProvider)
    assert provider.api_key == "sk-from-env"


def test_get_provider_header_overrides_env():
    """Header-provided key should always win over env var."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-from-env"}):
        provider = get_provider(LLMProviderType.OPENAI, api_key="sk-from-header")
    assert provider.api_key == "sk-from-header"


def test_get_provider_no_key_no_env():
    """Without header or env, api_key should be None."""
    clean = {v: "" for v in PROVIDER_ENV_VAR.values()}
    with patch.dict(os.environ, clean, clear=False):
        provider = get_provider(LLMProviderType.OPENAI)
    assert provider.api_key is None


def test_get_provider_local_provider_ignores_env():
    """Local providers (Ollama, LMStudio) don't use env var keys."""
    with patch.dict(os.environ, {}, clear=False):
        provider = get_provider(LLMProviderType.OLLAMA)
    assert provider.api_key is None
