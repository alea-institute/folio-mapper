"""Tests for the periodic provider-model refresh service (env-live + aggregator)."""

from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.llm_models import LLMProviderType, ModelInfo
from app.services.llm import model_refresh_service as svc
from app.services.llm.registry import KNOWN_MODELS


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


@contextmanager
def cycle(env_providers=(), aggregator=None, env_models=None):
    """Run one refresh cycle with controlled env providers + aggregator output.

    env_models: dict[LLMProviderType, list[ModelInfo]] returned by list_models,
    or an Exception to raise. Defaults to a single 'env-model'.
    """
    env_models = env_models or {}

    def fake_get_provider(*, provider_type, api_key=None, base_url=None, model=None):
        p = AsyncMock()
        result = env_models.get(provider_type, [ModelInfo(id="env-model", name="env-model")])
        if isinstance(result, Exception):
            p.list_models.side_effect = result
        else:
            p.list_models.return_value = result
        return p

    with patch.object(svc, "_providers_with_env_keys", return_value=list(env_providers)), \
         patch.object(svc, "fetch_aggregator_catalog", return_value=dict(aggregator or {})), \
         patch.object(svc, "get_provider", side_effect=fake_get_provider):
        svc._do_refresh()
        yield


# --- Existing behavior ---

def test_merged_known_models_returns_static_when_cache_empty():
    merged = svc.merged_known_models()
    assert "openai" in merged
    assert any(m.id == "gpt-4o" for m in merged["openai"])


def test_providers_with_env_keys_respects_env():
    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-x", "ANTHROPIC_API_KEY": ""}, clear=False):
        providers = svc._providers_with_env_keys()
        assert LLMProviderType.OPENAI in providers
        assert LLMProviderType.ANTHROPIC not in providers


def test_env_provider_populates_cache():
    models = {LLMProviderType.OPENAI: [ModelInfo(id="gpt-6", name="gpt-6")]}
    with cycle(env_providers=[LLMProviderType.OPENAI], env_models=models):
        pass
    cached = svc.get_cached_models(LLMProviderType.OPENAI)
    assert cached and any(m.id == "gpt-6" for m in cached)
    assert svc.get_refresh_status()["provenance"]["openai"] == "env"


def test_env_failure_is_isolated():
    models = {LLMProviderType.OPENAI: Exception("401 bad key")}
    with cycle(env_providers=[LLMProviderType.OPENAI], env_models=models):
        pass
    assert svc.get_cached_models(LLMProviderType.OPENAI) is None
    assert svc.get_refresh_status()["providers"]["openai"] == "error"


def test_no_env_keys_and_no_aggregator_is_noop():
    with cycle(env_providers=[], aggregator={}):
        pass
    # No cache entries -> merged equals the static floor.
    assert svc.get_refresh_status()["provenance"] == {}


# --- Aggregator layer (Phase 2) ---

def test_aggregator_unions_with_curated():
    agg = {LLMProviderType.MISTRAL: [ModelInfo(id="mistral-future-2027", name="Mistral Future")]}
    with cycle(env_providers=[], aggregator=agg):
        pass
    merged = svc.merged_known_models()
    ids = [m.id for m in merged["mistral"]]
    assert "mistral-future-2027" in ids  # new model added
    assert "codestral-latest" in ids  # curated model preserved (union, not replace)
    assert svc.get_refresh_status()["provenance"]["mistral"] == "aggregator"


def test_aggregator_does_not_regress_curated_context_window():
    # Aggregator reports a curated id with a wrong/low context window.
    agg = {LLMProviderType.MISTRAL: [ModelInfo(id="mistral-large-latest", name="x", context_window=8000)]}
    with cycle(env_providers=[], aggregator=agg):
        pass
    merged = svc.merged_known_models()
    large = next(m for m in merged["mistral"] if m.id == "mistral-large-latest")
    assert large.context_window == 128000  # curated value wins for known ids


def test_env_wins_over_aggregator():
    env_models = {LLMProviderType.OPENAI: [ModelInfo(id="env-only", name="env-only")]}
    agg = {LLMProviderType.OPENAI: [ModelInfo(id="agg-only", name="agg-only")]}
    with cycle(env_providers=[LLMProviderType.OPENAI], aggregator=agg, env_models=env_models):
        pass
    cached_ids = [m.id for m in svc.get_cached_models(LLMProviderType.OPENAI)]
    assert "env-only" in cached_ids
    assert "agg-only" not in cached_ids
    assert svc.get_refresh_status()["provenance"]["openai"] == "env"


def test_env_flip_evicts_aggregator_entry():
    # Cycle 1: mistral has no env key -> aggregator owns it.
    with cycle(env_providers=[], aggregator={LLMProviderType.MISTRAL: [ModelInfo(id="m-new", name="m-new")]}):
        pass
    assert svc.get_refresh_status()["provenance"]["mistral"] == "aggregator"
    # Cycle 2: mistral gains an env key -> env owns it, aggregator entry evicted.
    env_models = {LLMProviderType.MISTRAL: [ModelInfo(id="m-env", name="m-env")]}
    with cycle(env_providers=[LLMProviderType.MISTRAL], aggregator={}, env_models=env_models):
        pass
    cached_ids = [m.id for m in svc.get_cached_models(LLMProviderType.MISTRAL)]
    assert "m-env" in cached_ids and "m-new" not in cached_ids
    assert svc.get_refresh_status()["provenance"]["mistral"] == "env"


def test_both_sources_down_falls_back_to_curated():
    # Aggregator returns nothing (total failure); no env keys.
    with cycle(env_providers=[], aggregator={}):
        pass
    merged = svc.merged_known_models()
    # Keyless providers equal their static floor.
    assert [m.id for m in merged["mistral"]] == [m.id for m in KNOWN_MODELS[LLMProviderType.MISTRAL]]


def test_aggregator_deprecation_self_heals():
    with cycle(env_providers=[], aggregator={LLMProviderType.XAI: [
        ModelInfo(id="grok-A", name="A"), ModelInfo(id="grok-B", name="B")]}):
        pass
    assert any(m.id == "grok-B" for m in svc.merged_known_models()["xai"])
    # Next cycle drops grok-B upstream.
    with cycle(env_providers=[], aggregator={LLMProviderType.XAI: [ModelInfo(id="grok-A", name="A")]}):
        pass
    ids = [m.id for m in svc.merged_known_models()["xai"]]
    assert "grok-A" in ids and "grok-B" not in ids  # self-healed


# --- Endpoints ---

@pytest.mark.anyio
async def test_known_models_endpoint_includes_refreshed(client: AsyncClient):
    svc._cache["openai"] = [ModelInfo(id="gpt-99", name="gpt-99", context_window=1)]
    resp = await client.get("/api/llm/known-models")
    assert resp.status_code == 200
    assert any(m["id"] == "gpt-99" for m in resp.json()["openai"])


@pytest.mark.anyio
async def test_refresh_status_endpoint(client: AsyncClient):
    resp = await client.get("/api/llm/refresh-status")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("refresh_status", "interval_seconds", "providers", "provenance", "aggregator"):
        assert key in data
