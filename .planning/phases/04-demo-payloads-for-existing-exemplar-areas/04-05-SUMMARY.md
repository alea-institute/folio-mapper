---
phase: 04-demo-payloads-for-existing-exemplar-areas
plan: 05
wave: 4
status: complete
requirements: [DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05]
---

# Plan 04-05 Summary — Batch 3 / final (real-estate, banking-finance, immigration)

## What was built
- **Final 3 demo payloads** curated via the Claude Max proxy (mechanism in 04-03-SUMMARY.md):
  - `real-estate` — 15/19 (0.79), 3 enrichments
  - `banking-finance` — 14/18 (0.78), 2 enrichments
  - `immigration` — 13/18 (0.72), 2 enrichments
- All `provider: anthropic`, `model: claude-3-5-sonnet-latest`, `version: 1.3`, visible mix.
- Registered in all 3 demo harnesses. **This completes all 10 demo areas (DEMO-01).**

## D-02 coherence-over-richness notes
- `banking-finance` and `immigration` shipped **2 enrichments** instead of 3. The probe showed their non-lean high-scorers were dominated by Actor/Player or Legal-Entity noise (e.g., Hedge Fund, Société Anonyme) and thin coverage outside one cluster (immigration's Refugee/Asylum). Per D-02, fewer coherent enrichments beat injecting off-domain noise. Both still meet the ≥2 floor and show a clear visible mix.

## Phase gate
- **Full web suite green: 117 tests passed, 0 failures, 0 todos** (`pnpm --filter @folio-mapper/web test`).
- demo-mode-richness 10, demo-mode-no-network 11, demo-mode-roundtrip 10 — one row per area, all 10 areas.
- Every demo.json: `provider anthropic`, `model claude-3-5-sonnet-latest`, `version 1.3`, `0 < completed < total_nodes`.

## Phase outcome
All 10 exemplar areas now ship a real LLM-curated demo payload with a visible auto-accept/pending mix, loadable with zero runtime network calls. DEMO-01 through DEMO-05 satisfied.
