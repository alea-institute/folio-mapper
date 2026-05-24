# Phase 2: Demo Mode — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Source:** Synthesized from `/gsd-explore` design note (`.planning/notes/demo-mode-design.md`), spike 001 findings (`.planning/spikes/001-demo-pi-curation/README.md`), and three open-question decisions captured at the start of `/gsd-plan-phase`.

<domain>
## Phase Boundary

Add a **Demo** affordance that toggles the existing "Try an Exemplar" cards from their current lean precision-tuned payloads to rich pre-cached session payloads. The toggle is one button; the underlying mechanism is a parallel `*.demo.json` file per practice area, each containing a saved Stage-7A session that was produced by running the lean exemplar text (plus 2–3 thematic enrichment items) through the live pipeline once offline.

**In scope:**
- A Demo button on the exemplar carousel surface that flips an `exemplarMode: 'lean' | 'demo'` flag in the input store.
- Bundled `*.demo.json` files for the 10 existing practice areas (PI ships in this phase; remaining 9 are deferred to a follow-up).
- A documented curation workflow / reproducible script for regenerating demo payloads when the pipeline or FOLIO updates materially.
- Visual differentiation: a subtle "Demo" chip badge on each exemplar card while demo mode is active.
- Version-aware loading: each `*.demo.json` carries `pipeline_version` and `folio_version`; runtime shows a non-blocking warning banner if either is stale relative to the current build.
- Reuse of the existing Stage 7A session-load path — zero new pipeline logic at runtime.

**Out of scope:**
- Live pipeline runs as part of demo (this is what makes "demo" *demo* — it must be free and instant).
- Persisting demo mode across page reloads (session-scoped only).
- Transactional / regulatory practice areas (seeded as `.planning/seeds/demo-mode-transactional.md` for a future trigger).
- All 9 non-PI practice areas in this phase (per-area coverage probes recommended before scaling — see spike 001 decision).

</domain>

<decisions>
## Implementation Decisions

### Architecture (LOCKED)

- **Demo payload = lean exemplar text VERBATIM + 2–3 enrichment items.** Lean exemplars in `packages/core/src/exemplar/data.ts` stay untouched. Enrichments live only in `*.demo.json`.
- **Cached, not live.** Demo button loads pre-computed session JSON. Zero LLM calls at runtime. Token cost amortized to a one-time curation pass per practice area.
- **Same session-load path as Stage 7A.** No new pipeline logic. Whatever `useSession.loadSessionFile()` does today, the Demo button does the same with bundled JSON.
- **Mode is a Zustand store flag**: `exemplarMode: 'lean' | 'demo'` in `input-store.ts` (likely) or a new `demo-store.ts`. Session-scoped — does NOT persist via the existing `persist` middleware. Resets to `lean` on every app load.

### Bundling (LOCKED — chosen during /gsd-plan-phase)

- **In-app static ES module imports.** Place demo JSON under `apps/web/src/exemplar/demos/{slug}.demo.json` and import them as ES modules. Tree-shakable; consistent with how lean exemplar `data.ts` is shipped today; zero network round-trip; no backend coupling.
- Bundle size budget: each `*.demo.json` expected ~50–200 KB; 10 areas → ~1.5 MB before gzip. If the budget proves tight, swap to lazy `import()` calls without changing the public API.

### Versioning (LOCKED — chosen during /gsd-plan-phase)

- Each `*.demo.json` carries two snapshot fields:
  - `pipeline_version`: matches `backend/app/services/pipeline/__init__.py` semver or commit hash at curation time
  - `folio_version`: FOLIO ontology version string from `folio-python` at curation time
- On load, compare against runtime equivalents (frontend reads from a build-time-baked constant or a small `/api/version` endpoint). Mismatch → render a non-blocking warning banner ("Demo preset may be slightly stale — load anyway?"). Demo still loads. Banner dismissible.
- **Strict-block mode rejected** — refusing to load a demo at exactly the wrong moment (sales meeting, conference) is a worse UX than a stale-but-functional demo with a small warning.

### Visual Differentiation (LOCKED — chosen during /gsd-plan-phase)

- **Subtle "Demo" chip on each exemplar card while in demo mode.** Small pill, top-right corner of each card, color-keyed to a single accent (TBD by frontend implementation, but consistent with existing FOLIO Mapper palette).
- **Demo button itself toggles visibly active/inactive** so users see the mode shift in two places (button + cards).
- Carousel-wide recolor rejected as too loud; "no visual difference" rejected as too easy to forget which mode you're in.

### PI Demo Payload (LOCKED — from spike 001)

The PI demo payload uses lean exemplar text verbatim + 3 enrichment items in thematically-appropriate branches:

```
Personal Injury
  Motor Vehicle Accidents
    Motor Vehicle Law
    Accident Benefits Law
    Insurance Bad Faith               ← enrichment, ~1:4 fan-out
  Premises Liability
    Slip-and-Fall Negligence
    Dog Bite
  Medical Malpractice
    Medical Malpractice
    Wrongful Death Claim
    Loss of Consortium                ← enrichment, ~1:5 fan-out
  Product Liability
    Product Liability Law
    Defective Product Claims
  Mass Torts & Defamation
    Mass Torts Law
    Defamation Law
    Class Action                      ← enrichment, ~1:6 fan-out
```

19 items total. Drives natural fan-out heterogeneity — some 1:1, some 1:2-1:3, three rich 1:4+ moments.

### Curation Script (LOCKED)

A reproducible script lives under `scripts/` (or similar) that:
1. Reads a practice-area exemplar text + enrichment list.
2. POSTs to the running backend's `/api/pipeline/map` endpoint with that text.
3. Receives the `PipelineResponse`.
4. Constructs a `SessionFile` (per `packages/core/src/session/index.ts` schema, `SESSION_VERSION = '1.3'`) populating `mapping_response`, `pipeline_metadata`, `selections` (auto-accepts), `node_statuses`, `provider`, `model`, `pipeline_version`, `folio_version`.
5. Writes the result to `apps/web/src/exemplar/demos/{slug}.demo.json`.

Operator runs this manually (one-time per area, plus on material pipeline / FOLIO bumps) with a valid LLM API key. Output is committed to the repo.

### Demo Button Placement & Behavior (LOCKED)

- **Location**: header-adjacent or near the exemplar carousel header — the planner picks the exact location based on the existing UI hierarchy.
- **Behavior**: clicking toggles `exemplarMode`. While `mode === 'demo'`, the carousel cards still show the same exemplar metadata (label, description, practice area) but their click handler loads `{slug}.demo.json` instead of populating raw text.
- **State transitions**: if a user is mid-mapping (mapping store has data), a Demo click warns "This will replace your current work" — same affordance the existing exemplar click uses today.

### Claude's Discretion

- Exact CSS/Tailwind classes for the "Demo" chip and Demo button states.
- Exact location of the Demo button (header vs. carousel toolbar) — pick whichever fits existing UI hierarchy best.
- Whether to put the script under `scripts/curate-demos.ts` (TS) or `scripts/curate_demos.py` (Python via backend venv) — Python preferred since it can import the `folio-python` library directly for the `folio_version` snapshot.
- Whether `exemplarMode` lives in `input-store.ts` (single place to look) or a new minimal `demo-store.ts` (separation of concerns). Either works; pick smaller diff.
- Telemetry / analytics for Demo button usage — not in scope unless trivial to add.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase artifacts
- `.planning/spikes/001-demo-pi-curation/README.md` — feasibility findings, recommended PI payload, enrichment rationale
- `.planning/spikes/001-demo-pi-curation/items.json` — the 16-item lean PI exemplar parsed from `data.ts`
- `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` — reference for how to drive `folio-python` directly
- `.planning/notes/demo-mode-design.md` — design rationale (cached vs live, mode toggle UX)
- `.planning/seeds/demo-mode-transactional.md` — explicit deferral signal for non-litigation demos

### Codebase entry points (read before planning UI / store changes)
- `packages/core/src/exemplar/data.ts` — current lean exemplar definitions (untouched by this phase)
- `packages/core/src/session/index.ts` — `SessionFile` schema, `SESSION_VERSION = '1.3'`, `validateSession()`. Demo JSONs MUST conform.
- `apps/web/src/store/input-store.ts` — likely host for `exemplarMode` flag (or split into `demo-store.ts`)
- `apps/web/src/hooks/useSession.ts` (per project memory) — session load/recovery hook; demo button reuses this load path
- `packages/ui/src/components/input/` (or wherever the exemplar carousel lives) — UI surface for the chip badge + Demo button
- `backend/app/routers/pipeline.py` — `POST /api/pipeline/map` endpoint the curation script will call
- `backend/app/models/pipeline_models.py` — `PipelineRequest` / `PipelineResponse` shapes
- `backend/app/services/folio_service.py` — for FOLIO version snapshot in curation script

</canonical_refs>

<specifics>
## Specific Ideas

- The demo payload MUST exercise the same Stage 7A round-trip as a saved user session. The success test is: take a `pi.demo.json`, hand-edit its filename to `my-saved-session.json`, drag-drop into the existing session loader, and the result is identical to clicking the Demo button. This is a strong invariant that catches schema drift early.
- The "Demo" chip on each card and the Demo button itself should both reflect mode state — two affordances reinforcing each other so the user can't accidentally forget what mode they're in.
- For the curation script, prefer Python under `scripts/curate_demos.py` so it can import `folio_python` for the `folio_version` snapshot in one step. Operator workflow: `pnpm dev:api` → `python scripts/curate_demos.py --area personal-injury --provider anthropic` → JSON written to `apps/web/src/exemplar/demos/personal-injury.demo.json` → commit.
- Bundle size monitoring: add the demo JSON sizes to whatever existing bundle-size tracking the project uses (or a one-time check). If 10 areas push the main bundle past a sensible threshold, switch to dynamic `import()` per area before merging the 10th.

</specifics>

<deferred>
## Deferred Ideas

- Demo payloads for the other 9 practice areas (employment, M&A, IP, family, criminal, real estate, etc.). Per-area coverage probe recommended (mirror spike 001) before drafting enrichments. Tracked as the natural follow-up phase.
- Telemetry on Demo button usage (which areas get demoed, how often, how long users stay in demo mode before switching back).
- A "save as demo" affordance — turning a user's polished mapping into a demo preset. Future power-user feature.
- Transactional / regulatory demo presets. See `.planning/seeds/demo-mode-transactional.md` for trigger conditions.
- Persisting demo mode across reloads as a user preference. Currently rejected — mode is presentation intent, not preference.

</deferred>

---

*Phase: 02-demo-mode*
*Context gathered: 2026-05-10*
