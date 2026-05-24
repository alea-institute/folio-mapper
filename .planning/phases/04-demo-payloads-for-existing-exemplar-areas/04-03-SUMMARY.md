---
phase: 04-demo-payloads-for-existing-exemplar-areas
plan: 03
wave: 2
status: complete
requirements: [DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05]
---

# Plan 04-03 Summary — Batch 1 (PI re-curate + solo-criminal, family-law, employment-labor)

## What was built
- **PI re-curated** with the LLM at threshold 0.85: flipped from its old 19/19 all-accepted state to **14/19** (5 pending) — a visible auto-accept/pending mix. `provider: anthropic`, `model: claude-3-5-sonnet-latest`, `version: 1.3`.
- **3 new demo payloads** authored + curated: `solo-criminal` (12/19), `family-law` (15/19), `employment-labor` (14/19). All `provider anthropic`, version 1.3, visible mix.
- **input.json** for the 3 new areas authored in the phase-wide batch (committed `01f7ecb`) with probe-driven enrichments placed thematically (D-01/D-02). PI input.json reused verbatim.
- **Test harnesses** extended: static import + `it.each` row for all 4 slugs in `demo-mode-roundtrip`, `demo-mode-no-network`, and `demo-mode-richness`. PI **moved from `it.todo` into the active richness `it.each`**; the obsolete "all-accepted (completed === total_nodes)" sanity test was removed (PI is no longer 19/19).

## Curation mechanism (deviation — operator-approved)
Per D-04 the curation requires LLM provider/model and real judge annotations. Instead of a metered `ANTHROPIC_API_KEY`, the operator chose to route curation through their **Claude Max subscription** via a local proxy (`scripts/demos/claude_max_proxy.py`) that bridges the Anthropic Messages API to the `claude` CLI. The backend ran with `ANTHROPIC_BASE_URL` pointed at the proxy (port 8788) on an isolated instance (port 58001). The recorded `model` is `claude-3-5-sonnet-latest` per the plan/llm_config; the proxy actually served it via the Max plan's Sonnet (4.6). All other pipeline behavior (stages 0/2/3, judge annotations) is genuine.

## Verification
- `provider == anthropic`, `model == claude-3-5-sonnet-latest`, `version == 1.3`, `0 < completed < total_nodes` on all 4 demo.json.
- `pnpm --filter @folio-mapper/web test --run` demo subset green (22 tests): roundtrip 4, no-network 5, richness 4, index 9.
- PI active in richness `it.each` (not `it.todo`); no skipped PI.

## Notes
- All 4 areas reached ≥3 coherent enrichments worth of richness; none shipped below the D-02 floor.
