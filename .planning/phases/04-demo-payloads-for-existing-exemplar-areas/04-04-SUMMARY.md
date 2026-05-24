---
phase: 04-demo-payloads-for-existing-exemplar-areas
plan: 04
wave: 3
status: complete
requirements: [DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05]
---

# Plan 04-04 Summary — Batch 2 (corporate-ma, ip-tech, commercial-lit)

## What was built
- **3 transactional/litigation demo payloads** curated via the Claude Max proxy (same mechanism as Plan 03 — see 04-03-SUMMARY.md):
  - `corporate-ma` — 16/19 (0.84)
  - `ip-tech` — 15/19 (0.79)
  - `commercial-lit` — 16/19 (0.84)
- All `provider: anthropic`, `model: claude-3-5-sonnet-latest`, `version: 1.3`, visible auto-accept/pending mix (`0 < completed < total_nodes`).
- input.json authored in the phase-wide batch (`01f7ecb`) with 3 probe-driven enrichments each.
- Registered in `demo-mode-roundtrip`, `demo-mode-no-network`, and `demo-mode-richness` (import + `it.each` row per slug).

## Notes (RESEARCH Pitfall 6 — transactional areas)
These areas were flagged as potentially yielding fewer intuitive high-coverage enrichments. In practice the probe surfaced strong, coherent candidates (Fiduciary Duty, Securities/Financial Instruments Law, Direct/Vicarious Infringement, Breach of Contract Claims, etc.), and all three reached the full 3-enrichment richness with ratios at or above the visible-mix target. Coherence held without sacrificing richness (D-02).

## Verification
- `provider/model/version` correct and `0 < completed < total` on all 3 demo.json.
- Demo test subset green (22 tests across the 3 harnesses; 7 area rows each).
