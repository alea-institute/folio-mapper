"""Tests for the periodic provider-model refresh service."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.llm_models import LLMProviderType, ModelInfo
from app.services.llm import model_refresh_service as svc


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def _reset():
    svc.reset_model_refresher()
    yield
    svc.reset_model_refresher()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def test_merged_known_models_returns_static_when_cache_empty():
    merged = svc.merged_known_models()
    # Every provider in the static catalog is present and unchanged.
    assert "openai" in merged
    assert any(m.id == "gpt-4o" for m in merged["openai"])


def test_providers_with_env_keys_respects_env():
    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-x", "ANTHROPIC_API_KEY": ""}, clear=False):
        providers = svc._providers_with_env_keys()
        assert LLMProviderType.OPENAI in providers
        assert LLMProviderType.ANTHROPIC not in providers


@pytest.mark.anyio
async def test_refresh_provider_populates_cache():
    fresh = [ModelInfo(id="gpt-6", name="gpt-6"), ModelInfo(id="gpt-4o", name="gpt-4o")]
    mock_provider = AsyncMock()
    mock_provider.list_models.return_value = fresh
    with patch.object(svc, "get_provider", return_value=mock_provider):
        await svc._refresh_provider(LLMProviderType.OPENAI)

    cached = svc.get_cached_models(LLMProviderType.OPENAI)
    assert cached is not None
    assert any(m.id == "gpt-6" for m in cached)
    assert svc.get_refresh_status()["providers"]["openai"] == "ok"

    # merged_known_models should now surface the live list over the static one.
    merged = svc.merged_known_models()
    assert any(m.id == "gpt-6" for m in merged["openai"])


@pytest.mark.anyio
async def test_refresh_provider_failure_is_isolated():
    mock_provider = AsyncMock()
    mock_provider.list_models.side_effect = Exception("401 bad key")
    with patch.object(svc, "get_provider", return_value=mock_provider):
        await svc._refresh_provider(LLMProviderType.OPENAI)

    # No crash; status recorded as error; cache untouched.
    assert svc.get_cached_models(LLMProviderType.OPENAI) is None
    assert svc.get_refresh_status()["providers"]["openai"] == "error"


@pytest.mark.anyio
async def test_refresh_all_no_env_keys_is_noop():
    with patch.object(svc, "_providers_with_env_keys", return_value=[]):
        await svc._refresh_all()
    assert svc.get_refresh_status()["providers"] == {}


@pytest.mark.anyio
async def test_known_models_endpoint_includes_refreshed(client: AsyncClient):
    svc._cache["openai"] = [ModelInfo(id="gpt-99", name="gpt-99", context_window=1)]
    resp = await client.get("/api/llm/known-models")
    assert resp.status_code == 200
    data = resp.json()
    assert any(m["id"] == "gpt-99" for m in data["openai"])


@pytest.mark.anyio
async def test_refresh_status_endpoint(client: AsyncClient):
    resp = await client.get("/api/llm/refresh-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "refresh_status" in data
    assert "interval_seconds" in data
    assert "providers" in data
