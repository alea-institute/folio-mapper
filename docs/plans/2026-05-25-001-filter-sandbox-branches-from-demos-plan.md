# Plan: Filter sandbox/excluded FOLIO branches out of demo candidates

**Status:** Completed (2026-05-25)
**Created:** 2026-05-25
**Type:** Bug fix (demo data quality + pipeline-path hardening)

> **Deviation from plan (acceptance criterion #4):** the plan assumed no
> excluded-branch candidate was selected. In fact `immigration.demo.json` item 10
> "Deportation" was mapped to "460 Deportation (PACER NoS)" (Standards
> Compatibility) — 1 of 4 mappings. Per user decision, the branch_group AND that
> one orphaned selection were dropped; item 10 keeps its other 3 mappings
> (incl. "Deportation" Event @98), so `completed`/visible-mix are unaffected.
> The pipeline-path gap was real: `stage1_filter.py` never applied
> `EXCLUDED_BRANCHES` (the regular-search path in `folio_service.py` does) —
> now fixed with a single final-filter chokepoint in `run_stage1`.

## How to run this in CE (after a fresh session / `/clear`)

```
/ce:work docs/plans/2026-05-25-001-filter-sandbox-branches-from-demos-plan.md
```

(Or `/ce:plan docs/plans/2026-05-25-001-filter-sandbox-branches-from-demos-plan.md` first if you want to refine it.) This document is self-contained — it assumes **no memory of the prior session**.

---

## Background (project + deploy context)

**FOLIO Mapper** — pnpm monorepo (Vite + React 19 + Zustand frontend; FastAPI backend) that maps legal concept lists to the FOLIO ontology. It ships **pre-baked "demo" sessions** (`apps/web/src/exemplar/demos/*.demo.json`, one per practice area) so the tool can be demoed with **zero LLM cost** — demo mode loads a cached session client-side and makes **no pipeline calls**.

**Two-tier deploy:**
- **DEV** = Railway, auto-deploys the **`dev`** branch (URL: `folio-mapper-production.up.railway.app`). Built via the repo `Dockerfile`.
- **PROD** = `mapper.openlegalstandard.org` on Mike's AWS box (bare-metal systemd, **no Docker**), deploys the **`main`** branch.
  - SSH: `ssh -i "/home/damienriehl/Coding Projects/folio-ontokit.pem" ubuntu@54.224.195.12`
  - Repo: `/home/ubuntu/folio-mapper/` · backend venv `backend/.venv/` (uv-managed, **no pip** — use `~/.local/bin/uv pip ...`) · frontend dist `apps/web/dist/`
  - Service: `folio-mapper.service` on port 8002 · restart: `sudo -n systemctl restart folio-mapper` (passwordless sudo)
  - Deploy branch: **main** — only deploy when the user says so.

**Current state (as of 2026-05-25, commit `dbb64b2` on both `dev` and `main`, deployed to PROD):**
- Demos are cost-free, persist the Demo toggle, no stale banner, and show **1:many** mappings.
- Demos were re-curated via the full pipeline: `scripts/curate_demos.py --provider google --threshold 0.3 --accept-threshold 0.9 --multi-select-threshold 0.6`.
- **Embeddings are LIVE on PROD** (`all-MiniLM-L6-v2`, 18,324 concepts, cached at `~/.folio/cache/embeddings/`). PROD has a 4 GB swap safety net. (DEV embeddings remain off — ephemeral FS.)

---

## Problem

A FOLIO branch literally named **`ZZZ - SANDBOX: UNDER CONSTRUCTION`** appears as **candidates** in 2 demo payloads (`personal-injury.demo.json`, `family-law.demo.json`, 6 occurrences total). It is **not** selected as a mapping, but a viewer who expands that branch in the candidate tree sees an "UNDER CONSTRUCTION" label — unpolished for a demo.

**Key facts established:**
- `backend/app/services/branch_config.py` already defines `EXCLUDED_BRANCHES = frozenset({"Standards Compatibility", "ZZZ - SANDBOX: UNDER CONSTRUCTION"})`.
- The exclusion **is** applied in the regular search path and branch listings (`folio_service.py` lines ~267, 1433, 1480, 1651), pipeline stage 0 (`stage0_prescan.py`), and prompts (`prompts.py`).
- **Verified:** live `POST /api/mapping/candidates` on PROD does **not** return excluded branches (clean).
- **But** the demos — curated via `POST /api/pipeline/map` (full pipeline / stage 1) — **do** contain sandbox candidates. So either the **pipeline candidate path (stage 1) misses the `EXCLUDED_BRANCHES` filter**, or the demos predate the exclusion. Determine which.

This is primarily a **data scrub** (the demos), plus **closing any pipeline-path gap** so future curation stays clean.

---

## Goal / acceptance criteria

1. **No demo payload** (`apps/web/src/exemplar/demos/*.demo.json`) contains a `branch_groups[].branch` that is in `EXCLUDED_BRANCHES`.
2. The **pipeline candidate path** (`/api/pipeline/map` → stage 1) does **not** surface excluded branches (so re-curation stays clean).
3. A **test guards** both (a frontend demo test, and/or a backend test for the pipeline path).
4. `selections` / `node_statuses` / `completed` in demos are unchanged (no excluded-branch candidate is currently selected — verified — so the visible-mix / 1:many output is unaffected).
5. Deployed to DEV + PROD and verified in-browser (no sandbox branch in the candidate tree).

---

## Tasks

### 1. Confirm + close the pipeline-path gap (backend)
- Reproduce: query the pipeline candidate path for a term that hits an excluded-branch concept (e.g. input `"Accident Benefits Law"`) and check whether an excluded branch comes back. Compare `backend/app/services/pipeline/stage1_filter.py` (and how it pulls candidates from `folio_service` + the embedding index) against the regular-search path that already filters (`folio_service.py` ~1433/1480/1651).
- If stage 1 leaks excluded branches, apply the `EXCLUDED_BRANCHES` filter to its candidate results (import from `branch_config`). Filter by each candidate's `branch` display name.
- **Optional hardening:** the FAISS index build (`backend/app/services/embedding/service.py::build_embedding_index`) embeds *all* FOLIO concepts including excluded branches; downstream branch-filtering catches them, but you may also skip excluded-branch concepts at index-build time for cleanliness. (Not required for acceptance.)

### 2. Scrub the demo payloads (data)
- Write a one-off script (e.g. `scripts/output/scrub_excluded_branches.py`) that, for each `apps/web/src/exemplar/demos/*.demo.json`:
  - Removes every `mapping_response.items[].branch_groups[]` whose `branch` is in `EXCLUDED_BRANCHES` (source the set from `backend/app/services/branch_config.py` — do **not** hardcode).
  - Recomputes each item's `total_candidates`.
  - Leaves `selections`, `node_statuses`, `completed` untouched (assert first that no removed candidate's `iri_hash` appears in any selection — it shouldn't).
- Run it; confirm 0 excluded-branch branch_groups remain across all 10 demos.

### 3. Guard test
- Add a test asserting **no demo payload** contains an `EXCLUDED_BRANCHES` branch. Natural home: extend `apps/web/src/__tests__/demo-mode-richness.test.ts` or add a sibling (it already imports all 10 demo JSONs). Hardcode the excluded names there OR document the coupling to `branch_config.py`.
- If a backend gap was fixed in Task 1, add a backend test (pytest) asserting the pipeline path excludes those branches.

### 4. Verify
- `cd apps/web && npx vitest run` — all pass.
- If backend changed: `cd backend && .venv/bin/pytest` (relevant tests).
- Browser: load the personal-injury + family-law demos (Demo toggle on), expand the candidate tree, confirm **no "ZZZ - SANDBOX"** branch. Use chrome-devtools MCP per the user's global rules (screenshot to `$HOME` or the workspace, then read + clean up).

### 5. Deploy
- Commit on `dev` (descriptive message). Then:
  ```
  git checkout main && git merge --ff-only dev && git push origin dev && git push origin main
  ```
- **DEV** auto-deploys from `dev` (Railway).
- **PROD** (only after user confirms "push to prod"):
  ```
  ssh -i "/home/damienriehl/Coding Projects/folio-ontokit.pem" ubuntu@54.224.195.12
  cd /home/ubuntu/folio-mapper && git pull --ff-only origin main
  pnpm --filter @folio-mapper/web build          # demos are bundled into the frontend
  sudo -n systemctl restart folio-mapper          # only needed if backend (stage1) changed
  ```
  - This is data (demos) + possibly a backend stage-1 fix. The demo JSONs are bundled into the frontend, so a **frontend rebuild is required**. **No embedding rebuild needed.**
- Verify PROD: load a demo at `mapper.openlegalstandard.org`, confirm no sandbox branch.

---

## Key files
- `backend/app/services/branch_config.py` — `EXCLUDED_BRANCHES` (source of truth).
- `backend/app/services/folio_service.py` — regular-search exclusion (already correct; reference pattern).
- `backend/app/services/pipeline/stage1_filter.py` — pipeline candidate generation (suspected gap).
- `apps/web/src/exemplar/demos/*.demo.json` — the 10 demo payloads to scrub.
- `apps/web/src/__tests__/demo-mode-richness.test.ts` — imports all demos; good place for the guard test.
- `scripts/curate_demos.py` — curation tool (if you prefer to regenerate rather than scrub; needs a Google API key + local backend on :58000).

---

## Notes / gotchas (carried from prior session)
- **Verify demo behavior with a real `vite build` + `vite preview`, not just `vite dev`** — demo payloads are lazy-loaded via `import.meta.glob` in `apps/web/src/exemplar/demos/index.ts`; a prior `@vite-ignore` dynamic import worked in dev but 404'd in prod builds.
- **Demos must stay zero-cost:** loading a demo must make **no `/api/pipeline` or LLM calls** (there's a `demo-mode-no-network.test.tsx` invariant). The scrub doesn't affect this.
- **D-03 visible mix** (`0 < completed < total`) and **1:many** mappings must be preserved — the scrub only removes excluded-branch *candidates*, never selections, so both hold.
- The `EXCLUDED_BRANCHES` set also includes **"Standards Compatibility"** — scrub that too (use the set, not just the sandbox string).

---

## Housekeeping already completed (2026-05-25, prior session)
- Removed the heavy `[embedding]` deps from the **local** backend venv (torch/nvidia/faiss/sentence-transformers) — venv 8.2 GB → 2.1 GB. (PROD venv is untouched and keeps embeddings.)
- Deleted throwaway curation/validation scripts from `scripts/output/` (kept the pre-existing `validation_report.json`).
- No code or deployed artifacts were affected by the housekeeping.
