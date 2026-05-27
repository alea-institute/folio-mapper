"""LLM provider API endpoints."""

import asyncio
import logging
import os

from fastapi import APIRouter, Depends, Request

from app.models.llm_models import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    ModelInfo,
    ModelListRequest,
    ModelProbeRequest,
    ModelProbeResponse,
    ModelProbeResult,
)
from app.rate_limit import limiter
from app.services.auth import extract_api_key
from app.services.llm.model_refresh_service import (
    get_refresh_status,
    merged_known_models,
    trigger_model_refresh,
)
from app.services.llm.registry import KNOWN_MODELS, PROVIDER_ENV_VAR, get_provider, sort_and_enrich_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["llm"])

# Class names that signal a network-level failure across the various provider SDKs
# (openai, anthropic, httpx). Matched by name so we don't import every SDK here.
_CONNECTION_ERROR_NAMES = {
    "APIConnectionError",
    "APITimeoutError",
    "ConnectError",
    "ConnectTimeout",
    "ReadTimeout",
    "ConnectionError",
    "TimeoutException",
}


def _retry_after_seconds(exc: Exception) -> str | None:
    """Pull the Retry-After header off a provider error, if present."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    if headers is None:
        return None
    try:
        value = headers.get("retry-after")
    except Exception:
        return None
    return str(value) if value else None


def _is_quota_error(exc: Exception) -> bool:
    """A 429 can mean rate-limited (transient) or out-of-quota (billing).

    Distinguish via the provider's structured error code/type — not the raw
    message — so we don't leak details.
    """
    blob = f"{getattr(exc, 'code', '') or ''} {getattr(exc, 'type', '') or ''}".lower()
    return "quota" in blob or "insufficient" in blob or "billing" in blob


# Failure categories that are specific to the chosen model (other models with the
# same key may still work) — the client uses these to decide whether to probe.
MODEL_SPECIFIC_REASONS = {"model_unavailable", "access", "bad_request"}


def _categorize_connection_error(exc: Exception) -> tuple[str, str]:
    """Map a provider exception to a safe (message, reason) pair.

    The message is a static string only — never the raw exception text or the
    key — so we stay informative without leaking sensitive details (see security
    hardening). `reason` is a machine-readable category. The full exception is
    still logged server-side.
    """
    if type(exc).__name__ in _CONNECTION_ERROR_NAMES:
        return ("Couldn't reach the provider — check your network connection or the base URL.", "network")

    status = getattr(exc, "status_code", None)
    if status is None:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None)

    match status:
        case 401:
            return ("Authentication failed — the API key was rejected. Double-check the key.", "auth")
        case 403:
            return ("Access denied — this key isn't permitted to use this model or endpoint.", "access")
        case 404:
            return ("Model not found — it may not exist or isn't available to your account.", "model_unavailable")
        case 408:
            return ("The provider timed out. Try again in a moment.", "timeout")
        case 429:
            if _is_quota_error(exc):
                return (
                    "Out of quota — this key's account has no remaining credits. "
                    "Waiting won't help; check your plan & billing with the provider.",
                    "quota",
                )
            retry = _retry_after_seconds(exc)
            wait = f"about {retry} seconds" if retry else "30–60 seconds"
            return (f"Rate limited — too many requests. Wait {wait} and try again.", "rate_limit")
        case 400 | 422:
            return ("Request rejected — the selected model may not support these settings.", "bad_request")
        case s if isinstance(s, int) and 500 <= s < 600:
            return ("The provider reported a server error. Try again shortly.", "server")

    return ("Connection test failed", "unknown")


@router.post("/test-connection", response_model=ConnectionTestResponse)
@limiter.limit("20/minute")
async def test_connection(
    req: ConnectionTestRequest,
    request: Request,
    api_key: str | None = Depends(extract_api_key),
) -> ConnectionTestResponse:
    """Test connectivity and credentials for a given LLM provider."""
    try:
        provider = get_provider(
            provider_type=req.provider,
            api_key=api_key,
            base_url=req.base_url,
            model=req.model,
        )
        success = await provider.test_connection()
        return ConnectionTestResponse(
            success=success,
            message="Connection successful" if success else "Connection failed",
            model=req.model,
        )
    except Exception as exc:
        logger.exception("Connection test failed for provider %s", req.provider)
        message, reason = _categorize_connection_error(exc)
        return ConnectionTestResponse(
            success=False,
            message=message,
            reason=reason,
        )


async def _probe_model(
    provider, api_key: str | None, base_url: str | None, model: str, sem: asyncio.Semaphore
) -> ModelProbeResult:
    """Test a single model with the given key. Failures are categorized, not raised."""
    async with sem:
        try:
            client = get_provider(provider_type=provider, api_key=api_key, base_url=base_url, model=model)
            ok = await asyncio.wait_for(client.test_connection(), timeout=20)
            return ModelProbeResult(model=model, available=bool(ok))
        except Exception as exc:
            _, reason = _categorize_connection_error(exc)
            return ModelProbeResult(model=model, available=False, reason=reason)


@router.post("/probe-models", response_model=ModelProbeResponse)
@limiter.limit("6/minute")
async def probe_models(
    req: ModelProbeRequest,
    request: Request,
    api_key: str | None = Depends(extract_api_key),
) -> ModelProbeResponse:
    """Probe a set of models with the given key, reporting which are usable.

    Triggered by the client after a model-specific connection failure so the
    user can see which other models their key actually works with. Concurrency
    is bounded to avoid tripping the provider's rate limit.
    """
    models = req.models[:40]  # safety cap
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(
        *(_probe_model(req.provider, api_key, req.base_url, m, sem) for m in models)
    )
    return ModelProbeResponse(results=list(results))


@router.get("/key-status")
async def key_status() -> dict:
    """Return which providers have env var keys set (without revealing the keys)."""
    available = [p.value for p, var in PROVIDER_ENV_VAR.items() if os.environ.get(var)]
    return {"env_providers": available}


@router.get("/known-models")
async def known_models() -> dict[str, list[ModelInfo]]:
    """Return well-known models for every provider (no API key needed).

    Layers any periodically-refreshed live model lists (for providers with a
    server-side env key) over the static catalog so the dropdowns stay current.
    """
    return merged_known_models()


@router.get("/refresh-status")
async def refresh_status() -> dict:
    """Return the status of the periodic provider-model refresher."""
    return get_refresh_status()


@router.post("/refresh-models")
@limiter.limit("6/minute")
async def refresh_models(request: Request) -> dict:
    """Manually trigger a refresh of env-keyed providers' model lists."""
    return trigger_model_refresh()


@router.post("/models", response_model=list[ModelInfo])
@limiter.limit("20/minute")
async def list_models(
    req: ModelListRequest,
    request: Request,
    api_key: str | None = Depends(extract_api_key),
) -> list[ModelInfo]:
    """List available models for a given provider."""
    try:
        provider = get_provider(
            provider_type=req.provider,
            api_key=api_key,
            base_url=req.base_url,
        )
        live_models = await provider.list_models()
        if live_models:
            return sort_and_enrich_models(live_models, req.provider)
    except Exception:
        logger.warning("Live model fetch failed for %s, falling back to known models", req.provider)

    # Fallback to known models
    return KNOWN_MODELS.get(req.provider, [])
