---
phase: 06-demo-payloads-for-regulatory-exemplars
plan: 01
wave: 1
status: complete
requirements: [REGDEMO-01, REGDEMO-02, REGDEMO-03]
---

# Plan 06-01 Summary — Regulatory demo payloads (4 areas)

## What was built
- **4 demo payloads** curated via the full live pipeline (embedding index MiniLM
  18,324 concepts + spaCy + keyword + Stage-3 LLM judge), threshold 0.3 /
  accept-threshold 0.9:
  - `environmental-compliance` — 13/18 (0.72), judge 33 boost / 33 pen / 23 rej
  - `energy-utilities` — 15/18 (0.83), judge 43/43/8
  - `securities-regulation` — 13/18 (0.72), judge 30/62/27
  - `data-privacy` — 13/18 (0.72), judge 24/63/30
- All `provider: google`, `model: gemini-3-flash-preview`, `version: 1.3` —
  matching the post-Phase-4 Gemini re-curation standard (commit 5f64e41) so the
  full 14-demo set is consistent. Every item at 1:4+ fan-out (max 20 candidates);
  all 18 nodes judged in every payload — **no D-02 coherence override needed**
  (regulatory branches fan out richer than several litigation areas).
- **Registration:** 4 slugs added to `DEMO_AVAILABLE_SLUGS` (glob loader picks up
  the JSON automatically); 4 probe-items + 4 input.json generated reproducibly by
  `gen_regulatory_probe_items.py` / `gen_regulatory_inputs.py`.
- **Test harnesses:** all 6 updated (roundtrip, no-network, richness,
  excluded-branches: +4 static imports & it.each rows; smoke + manifest: slug
  arrays → 14, size assertions → 14). **Full suite: 166/166 green.**

## Browser verification (isolated context "mapper")
All 4 demos loaded in the real app via the Demo toggle: full mapping screen from
the cached payload, scored multi-branch candidates, visible auto-accept/pending
mix. Network panel: zero /api/pipeline or LLM calls — the first load rendered
fully with the backend OFFLINE, proving the zero-cost cached path. Screenshots in
`docs/evidence/phases-5-6/shots/`.

## Provider iteration note
Two earlier curation passes (Claude Max proxy → anthropic-labelled payloads) were
superseded when the smoke test surfaced the post-Phase-4 Gemini standard. Final
pass used the metered GOOGLE_API_KEY (cheapest tier, ~72 judged items, <$1),
reported in the evidence pack.

## Evidence
`docs/evidence/phases-5-6/` — pack.html + manifest (EP-MAPPER-REG-001..011),
including both subagent critiques and the density report.
