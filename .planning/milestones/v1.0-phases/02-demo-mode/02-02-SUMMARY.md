---
phase: 02-demo-mode
plan: 02
subsystem: ui
tags: [demo, curation, python, json, vite, static-import, no-llm]

requires:
  - phase: 02-01
    provides: ExemplarPanel Demo toggle + demo-store wiring; needs payloads to load
  - phase: 01-revamp-exemplars
    provides: lean PI exemplar text used as curation input source

provides:
  - Reproducible offline curation script (`scripts/curate_demos.py`) with --no-llm path
  - PI input JSON (lean exemplar verbatim + 3 enrichments)
  - PI demo session payload at `apps/web/src/exemplar/demos/personal-injury.demo.json`
  - Static ES-module manifest mapping exemplar slug -> demo payload

affects: [02-03, 02-04, demo-loading, version-mismatch-banner]

tech-stack:
  added: []
  patterns:
    - "Offline build-time curation script outputs committed JSON fixtures consumed via static Vite JSON import"
    - "Snapshot fields (pipeline_version, folio_version) stamped on payload for runtime mismatch detection"
    - "--no-llm fallback path via /api/mapping/candidates so payloads can be regenerated without an LLM key"

key-files:
  created:
    - scripts/curate_demos.py
    - scripts/demos/personal-injury.input.json
    - apps/web/src/exemplar/demos/personal-injury.demo.json
    - apps/web/src/exemplar/demos/index.ts
  modified: []

key-decisions:
  - "Use --no-llm path (symbolic candidates from /api/mapping/candidates) to bootstrap PI payload deterministically; LLM-driven regeneration remains supported for future areas"
  - "Stamp pipeline_version as `<package.json version>+<git-short-sha>` and folio_version from FOLIO().owl_version for runtime drift detection"
  - "Auto-select the top candidate per item (score >= threshold*100); fall back to unmapped otherwise"

patterns-established:
  - "Demo payloads live under apps/web/src/exemplar/demos/{slug}.demo.json, indexed by apps/web/src/exemplar/demos/index.ts via static JSON imports (Vite tree-shakes unused payloads)"
  - "DemoPayload interface is a structural sentinel (version + snapshot fields + [key]: unknown); full validateSession() runs at load time to avoid type drift"

requirements-completed:
  - PHASE-02-SC-04
  - PHASE-02-SC-05

duration: ~35min (across two sessions; --no-llm path added 2026-05-20)
completed: 2026-05-20
---

# Phase 02-02: PI Demo Payload Curation Summary

**Offline curation script + committed PI demo JSON + static Vite manifest, with --no-llm fallback so regeneration needs no LLM key.**

## Performance

- **Tasks:** 4 (1 input file, 1 curation script, 1 curation run, 1 manifest)
- **Files created:** 4
- **Backend tests:** unchanged (script does not modify backend)

## Accomplishments
- `scripts/curate_demos.py` drives either `/api/pipeline/map` (LLM-backed) or `/api/mapping/candidates` (--no-llm) and writes a SessionFile-shaped JSON
- PI input authored as a JSON spec (19 lines: 16 lean exemplar lines + 3 enrichments) committed at `scripts/demos/personal-injury.input.json`
- PI demo payload generated and committed at `apps/web/src/exemplar/demos/personal-injury.demo.json` — 19 items, all auto-mapped via top candidate, fan-out 41–148 candidates per item
- `apps/web/src/exemplar/demos/index.ts` exposes `DEMO_PAYLOADS`, `getDemoPayload(slug)`, and `DEMO_AVAILABLE_SLUGS` for Plan 02-03's runtime load path

## Task Commits

1. **Task 1: PI curation input** — `3b0cbc2` (feat: add PI curation input — lean exemplar + 3 enrichments)
2. **Task 2: Curation script** — `5a993be` (feat: add curate_demos.py — drives /api/pipeline/map for demo payloads)
   - **Follow-up:** `dcb4387` (feat: add --no-llm curation path via /api/mapping/candidates), `de758c3` (fix: correct stale variable in defensive api_key check)
3. **Task 3: Operator-run curation** — produced `personal-injury.demo.json` via `--no-llm` (no separate commit yet; will be in 02-02 plan-complete commit)
4. **Task 4: Static manifest** — pending in 02-02 plan-complete commit

## Files Created/Modified
- `scripts/curate_demos.py` — reproducible curation CLI; LLM and --no-llm modes; stamps pipeline_version + folio_version; emits SessionFile-shaped JSON
- `scripts/demos/personal-injury.input.json` — 19-line PI input (lean exemplar + Insurance Bad Faith, Loss of Consortium, Class Action enrichments)
- `apps/web/src/exemplar/demos/personal-injury.demo.json` — generated demo session (`version: "1.3"`, 19 items, all completed, snapshot fields populated)
- `apps/web/src/exemplar/demos/index.ts` — static slug→payload manifest, `DemoPayload` sentinel interface, `DEMO_AVAILABLE_SLUGS` for per-card gating

## Decisions Made
- **--no-llm bootstrap.** Curation script run with `--no-llm` to produce the initial PI payload using symbolic candidates (keyword + embedding + spaCy), avoiding LLM token spend during phase build. Plan 02-04 (or a future regeneration pass) can re-run with `--provider anthropic` to refresh with LLM-ranked candidates if quality dictates.
- **Top-candidate auto-selection.** All 19 items had at least one candidate above threshold, so the payload ships fully mapped (`node_statuses` all `"completed"`, `selections` populated with the top IRI per item). No item required manual curation in this pass.
- **Snapshot fields outside SessionFile schema.** `pipeline_version` and `folio_version` live at the top level of the JSON; `validateSession()` ignores unknown keys, so this is forward-compatible.

## Deviations from Plan

- **Task 3 self-served via --no-llm.** Plan listed Task 3 as a `checkpoint:human-action` requiring the operator's LLM API key. The follow-up `--no-llm` path (commits `dcb4387` + `de758c3`) enabled Claude to run the curation directly against a locally-started backend, producing a valid payload without burning user tokens. The LLM-backed path remains available for higher-fidelity regenerations.
- **MappingResponse shape note.** The plan's verification used `mapping.results[idx].candidates[0]`, but `MappingResponse` exposes `items[].branch_groups[].candidates[]`. The script handles both shapes; verification queries updated accordingly. No schema change needed.

**Total deviations:** 2 (1 path-of-execution change, 1 verification path correction)
**Impact:** Both deviations preserve the plan's intent (ship a committed PI demo payload + manifest) while avoiding unnecessary user setup.

## Issues Encountered
- Initial verification used `mapping_response.results` (does not exist); corrected to `mapping_response.items[].branch_groups[].candidates[]`. Payload itself was valid throughout — only the smoke-test jq path was wrong.

## User Setup Required
None. With `--no-llm`, only a locally-running backend (`pnpm dev:api`) is needed; no API key. To regenerate with LLM ranking later: export `ANTHROPIC_API_KEY` (or OpenAI/Google) and rerun `backend/.venv/bin/python scripts/curate_demos.py --area personal-injury --provider anthropic`.

## Next Phase Readiness
- **Plan 02-03** (runtime demo load path) can now `import { getDemoPayload } from '@/exemplar/demos'` and inject the PI payload into the session/mapping stores when the user clicks the Demo-toggled "Try an Exemplar" card.
- **Plan 02-04** (version-mismatch banner) can read `pipeline_version` / `folio_version` from the payload and compare against the running app's versions.
- No blockers for 02-03 / 02-04.

---
*Phase: 02-demo-mode*
*Completed: 2026-05-20*
