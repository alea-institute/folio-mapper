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


async def _refresh_provider(provider: LLMProviderType) -> None:
    """Fetch + cache live models for a single provider. Failures are isolated."""
    try:
        client = get_provider(provider_type=provider, api_key=None)
        live = await client.list_models()
        if live:
            _cache[provider.value] = sort_and_enrich_models(live, provider)
            _provider_status[provider.value] = "ok"
            logger.info("Model refresh: %s -> %d models", provider.value, len(live))
        else:
            _provider_status[provider.value] = "error"
    except Exception as e:
        # Keep any previously cached list; just record the failure.
        _provider_status[provider.value] = "error"
        logger.warning("Model refresh failed for %s: %s", provider.value, e)


async def _refresh_all() -> None:
    providers = _providers_with_env_keys()
    if not providers:
        logger.info("Model refresh: no providers with env-var keys; nothing to poll")
        return
    await asyncio.gather(*(_refresh_provider(p) for p in providers))


def _refresh_loop() -> None:
    """Run one refresh cycle and reschedule. Runs in a timer thread."""
    global _refresh_status, _last_refresh_time

    if _disabled():
        return

    with _lock:
        _refresh_status = "refreshing"
        try:
            asyncio.run(_refresh_all())
            _last_refresh_time = datetime.now(timezone.utc).isoformat()
            _refresh_status = "ok"
        except Exception as e:
            _refresh_status = "error"
            logger.error("Model refresh loop error: %s", e, exc_info=True)

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
    """KNOWN_MODELS with live-refreshed lists layered over the static catalog."""
    merged: dict[str, list[ModelInfo]] = {p.value: list(models) for p, models in KNOWN_MODELS.items()}
    for provider_value, models in _cache.items():
        if models:
            merged[provider_value] = models
    return merged


def get_refresh_status() -> dict:
    """Return current refresh status for the API."""
    return {
        "refresh_status": _refresh_status,
        "last_refresh_time": _last_refresh_time,
        "interval_seconds": _interval(),
        "disabled": _disabled(),
        "providers": dict(_provider_status),
    }


def trigger_model_refresh() -> dict:
    """Manually trigger a refresh cycle (used by the API / on demand)."""
    threading.Thread(target=_refresh_loop, daemon=True).start()
    return get_refresh_status()


def reset_model_refresher() -> None:
    """Reset all state. Used in tests."""
    global _timer, _cache, _provider_status, _last_refresh_time, _refresh_status
    stop_model_refresher()
    _cache = {}
    _provider_status = {}
    _last_refresh_time = None
    _refresh_status = "idle"
