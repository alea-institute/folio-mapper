# Phase 6: Demo Payloads for Regulatory Exemplars — Context

**Gathered:** 2026-07-07
**Status:** Executed alongside recording (TODAY-mode autonomy)

<domain>
## Phase Boundary

Curate a pre-cached demo payload for each of the 4 Phase-5 regulatory exemplars,
wire them into the existing demo infrastructure, and verify them in-app — completing
demo-mode coverage across the full 14-exemplar set.

**In scope:** `scripts/demos/{slug}-probe-items.json`, `{slug}.input.json`, and the
committed `apps/web/src/exemplar/demos/{slug}.demo.json` for each of the 4 new areas;
registration in `DEMO_AVAILABLE_SLUGS`; updates to the 6 demo test harnesses;
in-app browser verification.

**Out of scope:** Demo-mode architecture/UI (locked Phase 2). The lean exemplars
(Phase 5). The existing 10 demos (Phase 4).
</domain>

<decisions>
## Implementation Decisions (inherited from Phase 4 pattern)

### Curation mechanism (D-04 pattern, updated)
- Curate via `scripts/curate_demos.py --area {slug}`, driving the live backend
  `/api/pipeline/map` with the **full pipeline** (embedding index built, spaCy,
  keyword, and Stage-3 LLM judge) on an isolated port (58001).
- **Provider: `--provider google` (gemini-3-flash-preview).** After Phase 4, all 10
  existing demos were re-curated via Gemini (commit 5f64e41, "full-pipeline
  re-curation via Gemini"), and `demo-mode-smoke.test.ts` pins every payload to
  `provider=google` / `model=gemini-3-flash-preview`. The new demos follow the same
  standard so the 14-demo set stays consistent. (An earlier pass through the Claude
  Max proxy produced anthropic-labelled payloads; superseded for consistency.)
- Spend: metered GOOGLE_API_KEY, cheapest tier — ~72 judged items across 4 areas,
  well under $1; reported in the evidence pack.

### Threshold tuning (D-03)
- `--threshold 0.3` (rich candidate recall) + `--accept-threshold 0.9` (visible
  auto-accept/pending mix). Produced completed/total ratios in the Phase-4 target
  range (0.55–0.80) for all 4 areas.

### Enrichments (D-01/D-02)
- 2 coherent enrichment leaves per area (all exact FOLIO labels), inserted under a
  thematic branch. Unlike Phase 4's thin areas, these regulatory branches fan out
  richly (mean 12–16 relevant candidates/leaf), so every item clears the 1:4+ floor —
  no coherence override needed.

### Registration + tests
- `apps/web/src/exemplar/demos/index.ts`: LAZY_LOADERS auto-populate via
  `import.meta.glob('./*.demo.json')`; add the 4 slugs to the hardcoded
  `DEMO_AVAILABLE_SLUGS` set (→ 14 total).
- Update 6 test harnesses: `demo-mode-roundtrip`, `demo-mode-no-network`,
  `demo-mode-richness`, `demo-mode-excluded-branches` (static import + it.each row
  ×4), and `demo-mode-smoke` + `index.test.ts` (slug array + size assertion → 14).
</decisions>

<canonical_refs>
## Canonical References
- `.planning/phases/04-demo-payloads-for-existing-exemplar-areas/04-CONTEXT.md` — locked curation pattern.
- `scripts/curate_demos.py`, `scripts/demos/claude_max_proxy.py`, `scripts/demos/run_probe.py`.
- `apps/web/src/exemplar/demos/personal-injury.demo.json` — reference payload shape.
- `scripts/demos/gen_regulatory_probe_items.py`, `gen_regulatory_inputs.py` — reproducible I/O generators.
</canonical_refs>

---
*Phase: 06-demo-payloads-for-regulatory-exemplars*
