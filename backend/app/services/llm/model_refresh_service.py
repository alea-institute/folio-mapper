"""Background service: periodically refreshes provider model lists.

Polls each LLM provider that has a server-side env-var API key for its current
model list and caches the result in memory. The `/api/llm/known-models`
endpoint merges this cache over the static `KNOWN_MODELS` catalog so the model
dropdowns stay current — even for browsers that never supply their own key —
without a code change every time a provider ships a new model.

Providers whose keys live only in the user's browser (the common case) can't be
polled server-side; for those the static catalog and the on-demand live fetch
(triggered when the user opens Settings with a key) remain the source of truth.

Follows the singleton + threading.Timer pattern of owl_update_service.py.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from datetime import datetime, timezone

from app.models.llm_models import LLMProviderType, ModelInfo
from app.services.llm import model_catalog_sources
from app.services.llm.model_catalog_sources import fetch_aggregator_catalog, get_aggregator_status
from app.services.llm.registry import (
    KNOWN_MODELS,
    PROVIDER_ENV_VAR,
    get_provider,
    sort_and_enrich_models,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state (singleton pattern, matching owl_update_service.py)
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_timer: threading.Timer | None = None
_cache: dict[str, list[ModelInfo]] = {}
_cache_source: dict[str, str] = {}  # provider value -> "env" | "aggregator"
_provider_status: dict[str, str] = {}  # provider value -> "ok" | "error" | "skipped"
_last_refresh_time: str | None = None
_refresh_status: str = "idle"  # idle | refreshing | ok | error


# ---------------------------------------------------------------------------
# Config from env
# ---------------------------------------------------------------------------

def _interval() -> int:
    return int(os.environ.get("MODEL_REFRESH_INTERVAL", "86400"))  # 24h default


def _disabled() -> bool:
    return os.environ.get("MODEL_REFRESH_DISABLED", "").lower() == "true"


def _refresh_on_startup() -> bool:
    return os.environ.get("MODEL_REFRESH_ON_STARTUP", "true").lower() != "false"


# ---------------------------------------------------------------------------
# Refresh logic
# ---------------------------------------------------------------------------

def _providers_with_env_keys() -> list[LLMProviderType]:
    """Cloud providers that have a server-side API key configured via env."""
    return [p for p, var in PROVIDER_ENV_VAR.items() if os.environ.get(var)]


def _union_with_curated(provider: LLMProviderType, aggregator_models: list[ModelInfo]) -> list[ModelInfo]:
    """Union curated floor with new aggregator models.

    Every curated model survives (curated metadata wins for known ids); only
    aggregator models whose id isn't already curated are appended (in the
    source's newest-first order). This guarantees the modality filter can never
    *remove* a known-good model, only fail to add one.
    """
    curated = KNOWN_MODELS.get(provider, [])
    curated_ids = {m.id for m in curated}
    new_models = [m for m in aggregator_models if m.id not in curated_ids]
    return list(curated) + new_models


async def _refresh_env_provider(
    provider: LLMProviderType, new_cache: dict[str, list[ModelInfo]], new_source: dict[str, str]
) -> None:
    """Fetch live models for an env-keyed provider into the new cache. Isolated."""
    pv = provider.value
    try:
        client = get_provider(provider_type=provider, api_key=None)
        live = await client.list_models()
        if live:
            new_cache[pv] = sort_and_enrich_models(live, provider)
            new_source[pv] = "env"
            _provider_status[pv] = "ok"
            logger.info("Model refresh: %s -> %d models (env)", pv, len(live))
            return
        _provider_status[pv] = "error"
    except Exception as e:
        _provider_status[pv] = "error"
        logger.warning("Model refresh failed for %s: %s", pv, e)
    # Preserve last-good env list (if any) so a transient failure doesn't regress.
    if _cache_source.get(pv) == "env" and _cache.get(pv):
        new_cache[pv] = _cache[pv]
        new_source[pv] = "env"


async def _refresh_all() -> tuple[dict[str, list[ModelInfo]], dict[str, str]]:
    """Build a fresh cache: env-live for env-keyed providers, aggregator for the rest.

    Returns (cache, source). The two passes are disjoint per cycle (env XOR
    aggregator), and the fresh dict is swapped in atomically by the caller — so
    providers that switched ownership are evicted automatically.
    """
    new_cache: dict[str, list[ModelInfo]] = {}
    new_source: dict[str, str] = {}
    env_keyed = set(_providers_with_env_keys())

    # 1. Env-keyed providers — real account access wins.
    if env_keyed:
        await asyncio.gather(*(_refresh_env_provider(p, new_cache, new_source) for p in env_keyed))

    # 2. Aggregator — only for providers WITHOUT an env key (env-live always wins).
    #    fetch_aggregator_catalog uses blocking urllib, so run it off the loop.
    aggregator = await asyncio.to_thread(fetch_aggregator_catalog)
    for provider, models in aggregator.items():
        if provider in env_keyed or not models:
            continue
        unioned = _union_with_curated(provider, models)
        if unioned:
            new_cache[provider.value] = unioned
            new_source[provider.value] = "aggregator"

    return new_cache, new_source


def _do_refresh() -> None:
    """Run one refresh cycle and atomically swap in the new cache."""
    global _refresh_status, _last_refresh_time, _cache, _cache_source

    with _lock:
        _refresh_status = "refreshing"
        try:
            new_cache, new_source = asyncio.run(_refresh_all())
            _cache = new_cache  # atomic reference swap — readers see old or new, never partial
            _cache_source = new_source
            _last_refresh_time = datetime.now(timezone.utc).isoformat()
            _refresh_status = "ok"
        except Exception as e:
            _refresh_status = "error"
            logger.error("Model refresh loop error: %s", e, exc_info=True)


def _refresh_loop() -> None:
    """Run one refresh cycle and reschedule. Runs in a timer thread."""
    if _disabled():
        return
    _do_refresh()
    _schedule_next()


def _schedule_next() -> None:
    global _timer
    if _disabled():
        return
    _timer = threading.Timer(_interval(), _refresh_loop)
    _timer.daemon = True
    _timer.start()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def start_model_refresher() -> None:
    """Start the periodic model refresher. Called from lifespan."""
    if _disabled():
        logger.info("Model refresher disabled")
        return

    if _refresh_on_startup():
        # Brief delay so startup isn't blocked on provider network calls.
        timer = threading.Timer(15, _refresh_loop)
        timer.daemon = True
        timer.start()
    else:
        _schedule_next()

    logger.info(
        "Model refresher started (interval=%ds, env-keyed providers=%s)",
        _interval(),
        [p.value for p in _providers_with_env_keys()],
    )


def stop_model_refresher() -> None:
    """Stop the periodic model refresher. Called on shutdown."""
    global _timer
    if _timer:
        _timer.cancel()
        _timer = None
    logger.info("Model refresher stopped")


def get_cached_models(provider: LLMProviderType) -> list[ModelInfo] | None:
    """Return freshly-refreshed models for a provider, or None if not cached."""
    return _cache.get(provider.value)


def merged_known_models() -> dict[str, list[ModelInfo]]:
    """KNOWN_MODELS with refreshed lists (env-live or aggregator) layered over it."""
    merged: dict[str, list[ModelInfo]] = {p.value: list(models) for p, models in KNOWN_MODELS.items()}
    cache = _cache  # bind once — the refresh swaps the reference atomically
    for provider_value, models in cache.items():
        if models:
            merged[provider_value] = models
    return merged


def get_refresh_status() -> dict:
    """Return current refresh status + per-provider provenance for the API."""
    return {
        "refresh_status": _refresh_status,
        "last_refresh_time": _last_refresh_time,
        "interval_seconds": _interval(),
        "disabled": _disabled(),
        "providers": dict(_provider_status),
        "provenance": dict(_cache_source),  # provider value -> "env" | "aggregator"
        "aggregator": get_aggregator_status(),
    }


def trigger_model_refresh() -> dict:
    """Manually trigger a refresh cycle (used by the API / on demand)."""
    threading.Thread(target=_refresh_loop, daemon=True).start()
    return get_refresh_status()


def reset_model_refresher() -> None:
    """Reset all state. Used in tests."""
    global _timer, _cache, _cache_source, _provider_status, _last_refresh_time, _refresh_status
    stop_model_refresher()
    _cache = {}
    _cache_source = {}
    _provider_status = {}
    _last_refresh_time = None
    _refresh_status = "idle"
    model_catalog_sources.reset()
