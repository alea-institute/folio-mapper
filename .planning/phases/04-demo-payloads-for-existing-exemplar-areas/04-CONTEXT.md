# Phase 4: Demo Payloads for Existing Exemplar Areas - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Curate and ship **9 cached demo payloads** — one per existing non-PI practice area (Solo Criminal Defense, Family Law, Employment & Labor, Corporate M&A, IP & Technology, Commercial Litigation, Real Estate, Banking & Finance, Immigration) — reusing the demo-mode infrastructure already shipped in v1.0 Phase 2.

**In scope:** A `scripts/demos/{slug}.input.json` (lean exemplar text verbatim + enrichments) and a committed `apps/web/src/exemplar/demos/{slug}.demo.json` for each of the 9 areas; registration in the demo manifest (`apps/web/src/exemplar/demos/index.ts`); per-area coverage probing and enrichment selection.

**Out of scope:** Demo-mode architecture, UI, bundling, versioning, the chip, the toggle, the curation script (all LOCKED in Phase 2). The PI payload (already shipped). New regulatory exemplars (Phase 5) and their demos (Phase 6).

**Architecture is settled — this phase is content curation at scale, not engineering.** The spike (001) explicitly warns: "PI is FOLIO's densest branch; do not assume its density translates" — hence per-area probing.

</domain>

<decisions>
## Implementation Decisions

### Enrichment Sourcing (D-01)
- **Probe each of the 9 areas before drafting enrichments**, using the `run_coverage_probe.py` pattern from spike 001 (drive `folio-python` `search_by_label` directly, LLM-free, zero token cost).
- Pick **2–3 enrichment items per area**, each of which the probe shows yields **≥4 high-confidence (≥90) relevant candidates** in a thematically-appropriate branch (mirrors the PI selection of Insurance Bad Faith / Loss of Consortium / Class Action).
- Avoid "trap" enrichments that fan out into specialty noise (the spike's "Negligence → 22 noisy ENT/EMT matches" lesson). Prefer clean terms that fan out coherently.

### Thin-Area Richness Floor (D-02)
- **Ship all 9 payloads** (DEMO-01 is non-negotiable).
- For each area, add enrichments until it clears a **minimum richness bar — target ≥2 items at 1:4+ fan-out** — so no demo feels flat (DEMO-03).
- **Practice-area coherence outranks richness.** Never inject an off-domain enrichment just to pad fan-out. If an area genuinely cannot clear the bar with coherent enrichments, ship it at its best coherent richness and surface the shortfall to the operator rather than forcing noise.

### Auto-Accept Threshold (D-03)
- **Tune the `--threshold` flag per area** so each demo loads with a **visible mix of auto-accepted AND pending-review items** — the "the system did most of the work; your judgment finishes it" demonstration beat.
- Default is `0.3`; adjust per area. A demo that lands all-accepted or all-pending has lost the curation narrative and must be re-tuned (or selections hand-adjusted) before commit.

### Curation Model (D-04) — REVISED after research
- **Curate with the LLM: anthropic `claude-3-5-sonnet-latest`, `--provider anthropic`.** The judge annotations and accept/pending mix the demo narrative depends on (DEMO-03, phase goal) come from the LLM Stage 3 judge — `--no-llm` skips it entirely.
- **Correction:** the shipped PI demo was actually produced with `--no-llm` (`provider`/`model` = null, no real judge annotations) — NOT claude-3-5-sonnet as originally assumed. "Match PI" was based on a wrong premise.
- **Re-curate the PI demo** with `--provider anthropic` too, so all 10 demos are consistent and all carry real judge annotations. This intentionally overwrites the shipped `personal-injury.demo.json`.
- No hard cost cap (~$0.50–$2 per area, ~$10–$20 total for 10 incl. PI re-curation). Operator runs the script with their own `ANTHROPIC_API_KEY`.

### Bundle Size / Lazy Loading (added from research)
- The PI demo JSON is **~3.4 MB**; 10 eager ES-module imports would add ~34 MB to the initial bundle. The manifest (`apps/web/src/exemplar/demos/index.ts`) must migrate to **lazy `import()`** so demo payloads load on demand. `App.tsx` already calls the demo loader inside an async path, so the migration is safe. This is in-scope engineering for this phase (not a UI change).

### Claude's Discretion
- Exact enrichment items chosen per area (driven by probe results).
- Exact `--threshold` value per area to hit the visible-mix target.
- Exact numeric richness bar beyond the ≥2-items-at-1:4+ guideline.
- Per-area input-file slugs (must match the carousel/`data.ts` area identity; PI used `personal-injury`).
- Whether to batch all 9 in one PR or land incrementally — pick whatever keeps review tractable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Demo-mode decisions & feasibility (read first)
- `.planning/milestones/v1.0-phases/02-demo-mode/02-CONTEXT.md` — ALL locked demo-mode architecture/UI decisions; do not revisit
- `.planning/spikes/001-demo-pi-curation/README.md` — probe-then-enrich method, enrichment-selection lessons, expected distribution
- `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` — the per-item Stage-1 coverage probe to replicate for each area
- `.planning/spikes/001-demo-pi-curation/items.json` — example of a parsed lean exemplar payload

### Curation tooling & I/O
- `scripts/curate_demos.py` — the locked curation script (`--area`, `--provider`, `--threshold`); reads `scripts/demos/{slug}.input.json`, writes `apps/web/src/exemplar/demos/{slug}.demo.json`
- `apps/web/src/exemplar/demos/personal-injury.demo.json` — reference payload shape to match
- `apps/web/src/exemplar/demos/index.ts` — demo manifest; each new `{slug}.demo.json` must be registered here
- `scripts/demos/` — location for the per-area `{slug}.input.json` source files

### Source data & schema
- `packages/core/src/exemplar/data.ts` — the 10 lean exemplars; the 9 areas' text is copied VERBATIM into their input files (left untouched here)
- `packages/core/src/session/index.ts` — `SessionFile` schema, `SESSION_VERSION = '1.3'`; every demo JSON must conform
- `backend/app/routers/pipeline.py` + `backend/app/models/pipeline_models.py` — `POST /api/pipeline/map` shapes the script drives

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/curate_demos.py`: drives the full curation end-to-end — no script changes expected; just new input files + per-area invocations.
- `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py`: copy/generalize for the 9-area density probe.
- `apps/web/src/exemplar/demos/personal-injury.demo.json`: the canonical output template (round-trips through Stage 7A).

### Established Patterns
- Payload = lean exemplar text VERBATIM + 2–3 enrichments; lean `data.ts` untouched.
- `--threshold` controls auto-accept (top candidate per item accepted iff score ≥ threshold×100).
- `SESSION_VERSION = '1.3'` must mirror `packages/core/src/session/index.ts`.

### Integration Points
- New `scripts/demos/{slug}.input.json` per area (input side).
- New `apps/web/src/exemplar/demos/{slug}.demo.json` per area (output side), registered in `index.ts` (manifest).

</code_context>

<specifics>
## Specific Ideas

- **Round-trip invariant (acceptance test per area):** rename a produced `{slug}.demo.json` to `my-session.json`, drag-drop into the existing session loader — result must be identical to clicking the Demo card. Catches schema drift early (carried from Phase 2).
- The 9 areas and their carousel labels: Solo Criminal Defense, Family Law Firm, Employment & Labor, Corporate M&A, IP & Technology, Commercial Litigation, Real Estate, Banking & Finance, Immigration.
- Enrichment selection should distribute the "wow, look at the fan-out" moments across the demo (not bunched), as the PI payload did.

</specifics>

<deferred>
## Deferred Ideas

- Net-new regulatory/compliance exemplars (Phase 5) and their demo payloads (Phase 6).
- Telemetry on Demo button usage (which areas, how often).
- A "save as demo" affordance (turn a polished user mapping into a preset) — future power-user feature.
- Re-curating the existing PI demo if the curation model later changes — only relevant if D-04 is revisited.

</deferred>

---

*Phase: 04-demo-payloads-for-existing-exemplar-areas*
*Context gathered: 2026-05-24*
