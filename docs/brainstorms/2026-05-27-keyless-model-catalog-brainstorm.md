# Brainstorm: Auto-updating model catalog for keyless providers

**Date:** 2026-05-27
**Status:** Exploring → ready for open-question resolution

## What We're Building

A way to keep the LLM model dropdowns current — automatically, without a code change or deploy — for providers the server has **no env-var key** for and the user **hasn't entered a key** for. Today those providers fall back to the hand-maintained `KNOWN_MODELS` catalog in `backend/app/services/llm/registry.py`, which only changes when a human edits it.

The fix: extend the existing periodic refresh service (`services/llm/model_refresh_service.py`) to also pull a **keyless community aggregator**, filter it to text/chat models, and merge it over the static catalog via `/api/llm/known-models` — the same merge path the env-keyed live refresh already uses.

## Why This Approach

- **Goal = "new models appear fast, no deploy."** That rules out CI/PR sync (still a deploy) and build-time generation. A runtime pull on the existing 24h timer (plus on-startup and a manual trigger) means a newly-released model surfaces within a day, or instantly on restart — with zero human action.
- **No keyless official source exists** per provider (OpenAI/Anthropic/Google all require auth to list models). A community aggregator is the only keyless option.
- **Reuses proven plumbing.** The periodic refresh service, in-memory cache, graceful-degradation fallback, and `merged_known_models()` layering already exist (v0.11.0). This is an additive source, not new architecture.

## Key Decisions (resolved with user)

1. **Optimize for:** new models appearing fast, no deploy required.
2. **Curation:** auto-filter the source to chat/text models (drop image / audio / TTS / embedding / video / moderation / rerank) using the source's modality/`mode` field plus a small safety denylist. No human-in-the-loop step.
3. **Sources (two, for resilience):** **models.dev** primary (purpose-built directory: per-provider, modalities, context windows, pricing, release dates), **LiteLLM `model_prices_and_context_window.json`** fallback (explicit `mode` field, updated multiple times/week). If both are unreachable or return unparseable data, fall back silently to the curated static catalog.
4. **Curated static catalog stays as the floor** — guarantees the app works offline / if both sources vanish, and preserves good display names + recommended ordering.
5. **Scope:** cloud providers the aggregators cover (OpenAI, Anthropic, Google, Mistral, Cohere, Groq, xAI, …). Local providers (Ollama / LM Studio / Llamafile / Custom) keep discovering models live from the local server — unchanged.
6. **Per-key access is already handled** by the v0.12.0 probe + ✓/✗ feature, so it's fine for the aggregator to broaden the *visible* list even if a given key can't use every entry.

## Alternatives Considered (not chosen)

- **CI-synced curated JSON (scheduled GitHub Action → PR).** Keeps human review and avoids a runtime third-party dependency, but every update is a deploy — fails the "fast, no deploy" goal.
- **Show everything from the source, unfiltered.** Fastest to build but dumps image/audio/TTS models into the picker (the exact noise seen in Google's live list).
- **Single source.** Simpler, but a format change or outage freezes the catalog.

## Resolved Questions

1. **Metadata adoption** → **Add new IDs + fix context windows, keep curated display names.** The aggregator contributes new model IDs and corrects context windows (so pricing estimates stay accurate), but curated display names are preserved (no raw labels replacing nice ones). Unknown new models use the source's own name.
2. **Precedence vs. server env-live list** → **Env-live wins.** If a provider has a server env key, `/known-models` trusts its live list and ignores the aggregator for that provider. The aggregator therefore applies **only to providers without an env key** — exactly the gap being filled — so there is no conflict to reconcile. Resulting precedence per provider: user-key live fetch (frontend, that user) > server env-live > aggregator (keyless providers only) > curated static floor.

## Success Criteria

- A model released by a covered provider shows up in the dropdown automatically within one refresh cycle, with no code edit.
- The picker contains no non-text models (image/audio/etc.) from the new source.
- If both aggregators are down/changed, the app still shows the curated catalog with no errors.
