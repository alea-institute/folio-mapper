"""Tests for keyless aggregator catalog sources (models.dev + LiteLLM)."""

import gzip
import json

import pytest

from app.models.llm_models import LLMProviderType
from app.services.llm import model_catalog_sources as src


@pytest.fixture(autouse=True)
def _reset():
    src.reset()
    yield
    src.reset()


# --- Fixtures ---

MODELS_DEV_SAMPLE = {
    "openai": {
        "id": "openai",
        "models": {
            "gpt-4o": {
                "id": "gpt-4o", "name": "GPT-4o",
                "modalities": {"input": ["text", "image"], "output": ["text"]},
                "limit": {"context": 128000}, "release_date": "2024-05-13",
            },
            "gpt-6": {
                "id": "gpt-6", "name": "GPT-6",
                "modalities": {"input": ["text"], "output": ["text"]},
                "limit": {"context": 2000000}, "release_date": "2026-04-01",
            },
            "dall-e-3": {  # image output -> filtered
                "id": "dall-e-3", "name": "DALL-E 3",
                "modalities": {"input": ["text"], "output": ["image"]},
                "release_date": "2023-10-01",
            },
            "some-embed": {  # no text output -> filtered
                "id": "some-embed", "name": "Embed",
                "modalities": {"input": ["text"], "output": []},
            },
        },
    },
    "helicone": {  # unmapped provider -> ignored
        "id": "helicone",
        "models": {"x": {"modalities": {"output": ["text"]}}},
    },
    "cohere": {
        "id": "cohere",
        "models": {
            "command-z": {
                "id": "command-z", "name": "Command Z",
                "modalities": {"output": ["text"]}, "limit": {"context": 256000},
                "release_date": "2026-02-01",
            },
        },
    },
}

LITELLM_SAMPLE = {
    "sample_spec": {"litellm_provider": "openai", "mode": "chat"},  # skipped
    "gpt-4o": {"litellm_provider": "openai", "mode": "chat", "max_input_tokens": 128000},
    "text-embedding-3-small": {"litellm_provider": "openai", "mode": "embedding"},
    "dall-e-3": {"litellm_provider": "openai", "mode": "image_generation"},
    "groq/llama-3.3-70b-versatile": {"litellm_provider": "groq", "mode": "chat", "max_input_tokens": 128000},
    "azure/gpt-4o": {"litellm_provider": "azure", "mode": "chat"},  # unmapped -> ignored
    "mistral-large-latest": {"litellm_provider": "mistral", "mode": "chat", "max_tokens": 128000},
}


# --- models.dev parsing ---

def test_models_dev_filters_non_text_and_maps_providers():
    out = src._parse_models_dev(MODELS_DEV_SAMPLE)
    assert LLMProviderType.OPENAI in out
    ids = [m.id for m in out[LLMProviderType.OPENAI]]
    assert "gpt-4o" in ids and "gpt-6" in ids
    assert "dall-e-3" not in ids  # image output filtered
    assert "some-embed" not in ids  # no text output filtered
    # unmapped provider ignored; cohere mapped
    assert all(p in (LLMProviderType.OPENAI, LLMProviderType.COHERE) for p in out)


def test_models_dev_sorts_newest_first():
    out = src._parse_models_dev(MODELS_DEV_SAMPLE)
    ids = [m.id for m in out[LLMProviderType.OPENAI]]
    assert ids.index("gpt-6") < ids.index("gpt-4o")  # 2026 before 2024


def test_models_dev_carries_context_window():
    out = src._parse_models_dev(MODELS_DEV_SAMPLE)
    gpt4o = next(m for m in out[LLMProviderType.OPENAI] if m.id == "gpt-4o")
    assert gpt4o.context_window == 128000


# --- LiteLLM parsing ---

def test_litellm_filters_by_mode_and_skips_sample_spec():
    out = src._parse_litellm(LITELLM_SAMPLE)
    openai_ids = [m.id for m in out.get(LLMProviderType.OPENAI, [])]
    assert "gpt-4o" in openai_ids
    assert "text-embedding-3-small" not in openai_ids
    assert "dall-e-3" not in openai_ids
    assert "sample_spec" not in openai_ids


def test_litellm_normalizes_provider_prefixed_id():
    out = src._parse_litellm(LITELLM_SAMPLE)
    groq_ids = [m.id for m in out[LLMProviderType.GROQ]]
    assert "llama-3.3-70b-versatile" in groq_ids  # 'groq/' stripped


def test_litellm_ignores_unmapped_provider():
    out = src._parse_litellm(LITELLM_SAMPLE)
    # azure/gpt-4o maps to no native provider -> not present anywhere
    all_ids = [m.id for models in out.values() for m in models]
    assert all(not i.startswith("azure") for i in all_ids)


# --- per-provider fallback ---

def test_fetch_prefers_models_dev_fills_from_litellm(monkeypatch):
    def fake_get(url):
        return MODELS_DEV_SAMPLE if url == src.MODELS_DEV_URL else LITELLM_SAMPLE

    monkeypatch.setattr(src, "_http_get_json", fake_get)
    out = src.fetch_aggregator_catalog()
    # openai present in both -> models.dev wins (has gpt-6 which litellm lacks)
    assert any(m.id == "gpt-6" for m in out[LLMProviderType.OPENAI])
    # mistral only in litellm -> filled from litellm
    assert any(m.id == "mistral-large-latest" for m in out[LLMProviderType.MISTRAL])
    # groq only in litellm
    assert LLMProviderType.GROQ in out


# --- graceful degradation ---

def test_fetch_graceful_on_total_failure(monkeypatch):
    def boom(url):
        raise OSError("network down")

    monkeypatch.setattr(src, "_http_get_json", boom)
    out = src.fetch_aggregator_catalog()
    assert out == {}
    status = src.get_aggregator_status()
    assert status["sources"]["models.dev"] == "error"
    assert status["sources"]["litellm"] == "error"


def test_304_returns_last_good(monkeypatch):
    calls = {"n": 0}

    def fake_get(url):
        calls["n"] += 1
        if calls["n"] == 1:
            return MODELS_DEV_SAMPLE  # first fetch populates cache
        return None  # subsequent -> 304

    monkeypatch.setattr(src, "_http_get_json", fake_get)
    first = src._fetch_models_dev()
    assert first  # populated
    second = src._fetch_models_dev()
    assert second == first  # last-good reused on 304
    assert src.get_aggregator_status()["sources"]["models.dev"] == "not_modified"


def test_disabled_returns_empty(monkeypatch):
    monkeypatch.setenv("MODEL_CATALOG_AGGREGATOR_DISABLED", "true")
    assert src.fetch_aggregator_catalog() == {}


# --- HTTP hardening ---

class _FakeResp:
    def __init__(self, body: bytes, headers: dict):
        self._body = body
        self.headers = headers

    def read(self, n=-1):
        return self._body if n == -1 else self._body[:n]

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_http_get_json_rejects_oversized(monkeypatch):
    big = b"x" * (src._MAX_BYTES + 100)
    monkeypatch.setattr(src._opener, "open", lambda req, timeout=None: _FakeResp(big, {}))
    with pytest.raises(ValueError, match="exceeds"):
        src._http_get_json(src.MODELS_DEV_URL)


def test_http_get_json_decompresses_gzip(monkeypatch):
    payload = {"hello": "world"}
    gz = gzip.compress(json.dumps(payload).encode())
    monkeypatch.setattr(
        src._opener, "open",
        lambda req, timeout=None: _FakeResp(gz, {"Content-Encoding": "gzip"}),
    )
    assert src._http_get_json(src.MODELS_DEV_URL) == payload
