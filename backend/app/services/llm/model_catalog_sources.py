"""Keyless community model-catalog sources (models.dev + LiteLLM fallback).

Fetches current chat/text model lists from public aggregators that need no API
key, so providers WITHOUT a server env key still get a fresh catalog. Each model
is filtered to text/chat, mapped to our LLMProviderType, and (for models.dev)
sorted newest-first by release date.

All network/parse failures degrade gracefully: per-source last-good cache (up to
a max staleness), then empty — at which point the caller falls back to the
curated KNOWN_MODELS floor. Mirrors the hardened keyless-fetch contract of
owl_update_service.py (stdlib urllib, User-Agent, timeout, shape validation).

This module is the only place that talks to third-party catalog URLs. The URLs
are hardcoded constants (never derived from input), redirects are not followed,
responses are size-capped, and conditional GET (ETag) avoids re-downloading
unchanged data.
"""

from __future__ import annotations

import gzip
import json
import logging
import os
import time
import urllib.error
import urllib.request
from collections import defaultdict

from app.models.llm_models import LLMProviderType, ModelInfo

logger = logging.getLogger(__name__)

# --- Source URLs (hardcoded — never derived from user/provider input) ---
MODELS_DEV_URL = "https://models.dev/api.json"
LITELLM_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)

_USER_AGENT = "folio-mapper (+https://openlegalstandard.org)"
_TIMEOUT = 15
_MAX_BYTES = 8 * 1024 * 1024  # cap response size to protect the shared box
_MAX_STALE_SECONDS = 7 * 24 * 3600  # drop last-good after a week of failures

# Map each source's provider vocabulary to our enum. Keys not present here are
# ignored (never guessed). github_models is intentionally excluded — it re-hosts
# other vendors under namespaced ids the aggregators don't carry, so it stays on
# the curated catalog.
MODELS_DEV_PROVIDER_MAP: dict[str, LLMProviderType] = {
    "openai": LLMProviderType.OPENAI,
    "anthropic": LLMProviderType.ANTHROPIC,
    "google": LLMProviderType.GOOGLE,
    "mistral": LLMProviderType.MISTRAL,
    "cohere": LLMProviderType.COHERE,
    "groq": LLMProviderType.GROQ,
    "xai": LLMProviderType.XAI,
    "x-ai": LLMProviderType.XAI,
    "meta": LLMProviderType.META_LLAMA,
    "meta-llama": LLMProviderType.META_LLAMA,
    "llama": LLMProviderType.META_LLAMA,
}

LITELLM_PROVIDER_MAP: dict[str, LLMProviderType] = {
    "openai": LLMProviderType.OPENAI,
    "anthropic": LLMProviderType.ANTHROPIC,
    "gemini": LLMProviderType.GOOGLE,
    "mistral": LLMProviderType.MISTRAL,
    "cohere": LLMProviderType.COHERE,
    "cohere_chat": LLMProviderType.COHERE,
    "groq": LLMProviderType.GROQ,
    "xai": LLMProviderType.XAI,
    "meta_llama": LLMProviderType.META_LLAMA,
}

# Denylist of clearly-non-chat LiteLLM modes. Anything else (chat, completion, or
# an unknown future mode) is kept, so a new model category defaults to visible.
_LITELLM_DENY_MODES = {
    "embedding",
    "image_generation",
    "audio_transcription",
    "audio_speech",
    "moderation",
    "rerank",
    "image",
    "video",
}

# --- Module state (per-source last-good cache + ETags + health) ---
_etags: dict[str, str] = {}
_source_cache: dict[str, dict[LLMProviderType, list[ModelInfo]]] = {}
_source_last_success: dict[str, float] = {}
_source_status: dict[str, str] = {}  # ok | not_modified | error | stale | disabled


def _disabled() -> bool:
    return os.environ.get("MODEL_CATALOG_AGGREGATOR_DISABLED", "").lower() == "true"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Refuse to follow redirects so a 3xx to a private IP can't bypass checks."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def _http_get_json(url: str):
    """GET + parse JSON with hardening. Returns parsed JSON, or None on HTTP 304.

    Raises on network errors, oversized bodies, redirects, or invalid JSON — the
    caller turns those into a graceful per-source fallback.
    """
    headers = {"User-Agent": _USER_AGENT, "Accept-Encoding": "gzip"}
    if url in _etags:
        headers["If-None-Match"] = _etags[url]
    req = urllib.request.Request(url, headers=headers)

    try:
        resp = _opener.open(req, timeout=_TIMEOUT)
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return None  # unchanged — caller keeps last-good
        raise

    with resp:
        raw = resp.read(_MAX_BYTES + 1)
        if len(raw) > _MAX_BYTES:
            raise ValueError(f"response from {url} exceeds {_MAX_BYTES} bytes")
        if (resp.headers.get("Content-Encoding") or "").lower() == "gzip":
            raw = gzip.decompress(raw)
        etag = resp.headers.get("ETag")
        if etag:
            _etags[url] = etag

    return json.loads(raw.decode("utf-8"))


def _last_good(source: str) -> dict[LLMProviderType, list[ModelInfo]]:
    """Return the source's last-good catalog if recent enough, else empty."""
    last = _source_last_success.get(source)
    if last is not None and (time.time() - last) <= _MAX_STALE_SECONDS:
        return _source_cache.get(source, {})
    if source in _source_cache:
        _source_status[source] = "stale"
    return {}


# --- models.dev adapter ---

def _models_dev_is_text(model: dict) -> bool:
    output = (model.get("modalities") or {}).get("output") or []
    return "text" in output and "image" not in output


def _parse_models_dev(data: dict) -> dict[LLMProviderType, list[ModelInfo]]:
    out: dict[LLMProviderType, list[ModelInfo]] = defaultdict(list)
    for provider_key, pinfo in (data or {}).items():
        provider = MODELS_DEV_PROVIDER_MAP.get(provider_key)
        if provider is None:
            continue
        models = (pinfo or {}).get("models") or {}
        dated: list[tuple[str, ModelInfo]] = []
        for model_id, m in models.items():
            try:
                if not isinstance(m, dict) or not _models_dev_is_text(m):
                    continue
                ctx = (m.get("limit") or {}).get("context")
                dated.append((
                    m.get("release_date") or "",
                    ModelInfo(id=m.get("id") or model_id, name=m.get("name") or model_id, context_window=ctx),
                ))
            except Exception:  # tolerate a single malformed entry
                continue
        dated.sort(key=lambda t: t[0], reverse=True)  # newest release_date first
        out[provider].extend(mi for _, mi in dated)
    return dict(out)


def _fetch_models_dev() -> dict[LLMProviderType, list[ModelInfo]]:
    try:
        data = _http_get_json(MODELS_DEV_URL)
        if data is None:
            _source_status["models.dev"] = "not_modified"
            return _source_cache.get("models.dev", {})
        result = _parse_models_dev(data)
        _source_cache["models.dev"] = result
        _source_last_success["models.dev"] = time.time()
        _source_status["models.dev"] = "ok"
        return result
    except Exception as e:
        logger.warning("models.dev catalog fetch failed: %s", e)
        _source_status["models.dev"] = "error"
        return _last_good("models.dev")


# --- LiteLLM adapter ---

def _normalize_litellm_id(provider_key: str, model_id: str) -> str:
    """Strip a leading '<provider>/' so ids match our native curated ids."""
    prefix = f"{provider_key}/"
    return model_id[len(prefix):] if model_id.startswith(prefix) else model_id


def _parse_litellm(data: dict) -> dict[LLMProviderType, list[ModelInfo]]:
    out: dict[LLMProviderType, list[ModelInfo]] = defaultdict(list)
    for model_id, m in (data or {}).items():
        if model_id == "sample_spec" or not isinstance(m, dict):
            continue
        provider = LITELLM_PROVIDER_MAP.get(m.get("litellm_provider"))
        if provider is None:
            continue
        if m.get("mode") in _LITELLM_DENY_MODES:
            continue
        try:
            ctx = m.get("max_input_tokens") or m.get("max_tokens")
            native_id = _normalize_litellm_id(m.get("litellm_provider", ""), model_id)
            out[provider].append(ModelInfo(id=native_id, name=native_id, context_window=ctx))
        except Exception:
            continue
    return dict(out)


def _fetch_litellm() -> dict[LLMProviderType, list[ModelInfo]]:
    try:
        data = _http_get_json(LITELLM_URL)
        if data is None:
            _source_status["litellm"] = "not_modified"
            return _source_cache.get("litellm", {})
        result = _parse_litellm(data)
        _source_cache["litellm"] = result
        _source_last_success["litellm"] = time.time()
        _source_status["litellm"] = "ok"
        return result
    except Exception as e:
        logger.warning("litellm catalog fetch failed: %s", e)
        _source_status["litellm"] = "error"
        return _last_good("litellm")


# --- Public API ---

def fetch_aggregator_catalog() -> dict[LLMProviderType, list[ModelInfo]]:
    """Fetch the keyless catalog: models.dev primary, LiteLLM per-provider fallback.

    Returns text/chat models per provider (models.dev sorted newest-first). Never
    raises; on total failure returns whatever last-good remains, else empty.
    """
    if _disabled():
        _source_status["models.dev"] = _source_status["litellm"] = "disabled"
        return {}

    models_dev = _fetch_models_dev()
    litellm = _fetch_litellm()

    # Per-provider: prefer models.dev where present, fill gaps from LiteLLM.
    out: dict[LLMProviderType, list[ModelInfo]] = {}
    for provider in set(models_dev) | set(litellm):
        if models_dev.get(provider):
            out[provider] = models_dev[provider]
        elif litellm.get(provider):
            out[provider] = litellm[provider]
    return out


def get_aggregator_status() -> dict:
    """Per-source health for the refresh-status endpoint."""
    return {
        "disabled": _disabled(),
        "sources": dict(_source_status),
        "last_success": {k: int(v) for k, v in _source_last_success.items()},
    }


def reset() -> None:
    """Clear all module state. Used in tests."""
    _etags.clear()
    _source_cache.clear()
    _source_last_success.clear()
    _source_status.clear()
