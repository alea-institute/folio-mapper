---
quick_id: 260525-bz7
description: Update most-recent LLM models from providers (Google, Anthropic, OpenAI)
date: 2026-05-25
status: complete
commit: 482ee8e
---

# Quick Task 260525-bz7 Summary

## What changed
Refreshed the model catalogs/defaults for the three named providers. The central
`registry.py` was already current through GPT-5.2 / Gemini 3.1 / Claude Opus 4.6, so this
filled the specific gaps and refreshed the stale curation defaults.

**Verified current model IDs (web-checked 2026-05-25, not from training data):**
- **Anthropic** → added `claude-opus-4-7` (latest GA, step-change over 4.6). Sonnet 4.6 / Haiku 4.5 already present.
- **OpenAI** → added `gpt-5.5` + `gpt-5.5-pro` (released 2026-04-24); default `gpt-5.2` → `gpt-5.5`.
- **Google** → added `gemini-3.5-flash` (GA flagship) + `gemini-3.1-flash-lite`. Default set to `gemini-3-flash-preview` (Gemini 3 Flash) per operator follow-up. Note: Gemini 3 Flash is still Pre-GA/preview (per Google docs 2026-05-22); the GA flash tier is `gemini-3.5-flash` if a stable default is later preferred.

## Files modified (4 sync points)
- `backend/app/services/llm/registry.py` — KNOWN_MODELS (OpenAI/Anthropic/Google appends) + DEFAULT_MODELS (OpenAI, Google, GitHub Models)
- `backend/app/services/llm/anthropic_provider.py` — `_FALLBACK_MODELS` += claude-opus-4-7
- `packages/core/src/llm/provider-meta.ts` — frontend `defaultModel` mirror (OpenAI, Google, GitHub Models)
- `scripts/curate_demos.py` — `DEFAULT_MODELS` refreshed off gpt-4o / gemini-1.5 / claude-3-5-sonnet

## Decisions
- **Anthropic default left at `claude-sonnet-4-6`** — Sonnet is the correct default tier (cost/speed); Opus 4.7 is added to the catalog but too costly to default to. No newer Sonnet exists.
- **Scope limited to the three named providers.** Mistral/Cohere/Meta/xAI/Groq registry entries are recent (command-a-reasoning-08-2025, llama-4, grok-4-0709) and were left as-is.
- **Existing demo.json files untouched** — they record the model used at curation time; phase-04 tests assert against those committed files, not `curate_demos.py` defaults, so changing the default is safe.

## Verification
- Backend: `pytest tests/` → **462 passed**; `test_llm.py` (model registry/enrichment) green.
- Frontend: `pnpm --filter @folio-mapper/web build` typecheck clean; `pnpm test` → **128 passed**.
- The `sort_and_enrich_models` ordering test was unaffected (it references only gpt-5/gpt-5.2 in its own fixture; new models appended after).

## Notes
- Model IDs change frequently; this was verified against provider docs/announcements on 2026-05-25. Re-verify when refreshing again.
