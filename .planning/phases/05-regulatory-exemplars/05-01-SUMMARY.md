---
phase: 05-regulatory-exemplars
plan: 01
wave: 1
status: complete
requirements: [REG-01, REG-02, REG-03, REG-04]
---

# Plan 05-01 Summary — Regulatory exemplar selection + authoring

## What was built
- **Deterministic density survey** (`scripts/demos/regulatory_density_survey.py`
  → `regulatory-density-report.json`) over FOLIO's 174-child Area-of-Law tree.
  Signals: branch density (recursive descendants), definition coverage, and
  10-leaf exact-hit feasibility. LLM-free (folio-python only), reproducible.
- **4 regulatory exemplars** appended to `packages/core/src/exemplar/data.ts`
  (5 branches × 2 leaves each):
  - `environmental-compliance` — Environmental Compliance (density 12, 10/10 exact)
  - `energy-utilities` — Energy & Utilities (density 7, 10/10 exact)
  - `securities-regulation` — Securities Regulation (density 10, 10/10 exact)
  - `data-privacy` — Data Privacy & Cybersecurity (distributed, 10/10 exact)
- **100%-hit-rate gate** (`scripts/demos/validate_exemplar_hits.py`): **40/40
  leaves PASS** — every leaf is an exact, unique FOLIO concept ranked first at
  score 100.

## Selection rationale (density × diversity)
Four distinct regulatory domains chosen over raw density alone: natural resources
(environmental), energy/utilities, financial-markets regulation (securities), and
tech/data regulation (data-privacy). No area was forced to "best-available"
matches — the exact-hit count was the hard gate.

## Documented exclusions (probe gate working as intended)
- **Tax & Revenue** — 5/10 exact leaves. FOLIO's tax branch is leaf-thin;
  Income/Property/Sales/International/Corporate Tax have no precise node. DROPPED.
- **Healthcare / health-privacy** — 3/10 exact leaves, branch density 0. The
  mission's "plausible candidate" that the probe correctly gates out. DROPPED.

## Notes / flags
- **Securities overlap:** 6 of its 10 leaves also appear in the Banking & Finance
  or Corporate M&A exemplars (FOLIO concentrates securities concepts there). It is
  framed as enforcement/market-regulation to differentiate, but a presenter may
  find it adjacent to Banking & Finance in the carousel. Flagged to the PM QA
  queue (keep vs. swap for a more distinct 4th area).
- **Carousel wiring:** verified — `App.tsx` renders `exemplars={EXEMPLARS}`, so the
  4 new cards appear automatically; no UI code change needed. Demo-mode payloads
  land in Phase 6 (until then the new slugs fall through to lean mode).

## Critique-driven revision (2 subagent reviews)
Two independent subagent critiques (ontology-precision via FOLIO MCP; product/persona)
flagged real defects in the first-draft leaves. All were fixed before ship:
- **energy** — removed circular leaf (`Renewable Energy Law` is the parent of Solar/
  Wind/Hydro); dropped the "Baseload Power" jargon branch; regrouped hydro; swapped the
  ancestor `Utilities Industry` for `Project Finance Law` (AoL). Now 7 AoL + 3 energy-
  specific FOLIO concepts, zero circularity.
- **data-privacy** — dropped `Information Security Law` (was both the root branch and a
  leaf — circular + duplicate of `Cybersecurity Law`), `Right to Privacy` (a Civil
  Right, duplicate of `Privacy Law`), and `Records Management` (Business-of-Law). Added
  `Consumer Protection Law`, `Telecommunications Law`, `Freedom of Information Act Claim`.
- **securities** — reframed from deal-work to enforcement/regulation, cutting leaf
  overlap with banking-finance from 4 to **0** (retitled card "Securities Enforcement").
- **environmental** — moved `Chemical Safety Law` out of the mis-named "Corporate
  Sustainability" branch; paired ESG with `Impact Assessment Law`.
- **Gate hardened:** `validate_exemplar_hits.py` now also fails on **circularity** (no
  leaf may be an ancestor of a co-leaf) — the check that caught the energy defects.

## Verification
- `pnpm --filter @folio-mapper/core test` → 37 passed.
- `validate_exemplar_hits.py` (exact + unique + score-100 + anti-circularity) → 40/40 PASS.
- No exemplar-count test assertions exist to break (grep-confirmed).
