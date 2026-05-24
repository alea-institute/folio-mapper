---
phase: 04-demo-payloads-for-existing-exemplar-areas
plan: "02"
subsystem: scripts/demos
tags: [probe-tooling, demo-curation, folio-search, argparse, json-fixtures]
dependency_graph:
  requires: []
  provides:
    - scripts/demos/run_probe.py
    - scripts/demos/{slug}-probe-items.json (×9)
    - scripts/demos/verify_probe_items.py
  affects:
    - plans 03-05 (per-area probe runs consume these files)
tech_stack:
  added: []
  patterns:
    - argparse CLI generalization from spike script
    - JSON fixture authoring from data.ts verbatim labels
    - Nyquist structural checker pattern (verify_probe_items.py)
key_files:
  created:
    - scripts/demos/run_probe.py
    - scripts/demos/verify_probe_items.py
    - scripts/demos/solo-criminal-probe-items.json
    - scripts/demos/family-law-probe-items.json
    - scripts/demos/employment-labor-probe-items.json
    - scripts/demos/corporate-ma-probe-items.json
    - scripts/demos/ip-tech-probe-items.json
    - scripts/demos/commercial-lit-probe-items.json
    - scripts/demos/real-estate-probe-items.json
    - scripts/demos/banking-finance-probe-items.json
    - scripts/demos/immigration-probe-items.json
  modified: []
decisions:
  - "run_probe.py derives both input and output paths from --area slug (SCRIPT_DIR/{slug}-probe-items.json and {slug}-probe-candidates.json); no per-area copies of the script needed"
  - "RELEVANT_BRANCHES set and _branch_of helper copied verbatim from spike to preserve exact counting semantics"
  - "verify_probe_items.py is argparse-free (script is always run against all 9 slugs in a single pass) — simpler and sufficient for the Nyquist gate"
  - "Per-item stderr line shows only high_score_relevant count (the D-01 decision metric) to minimize operator scan time"
metrics:
  duration: "147 seconds"
  completed: "2026-05-24"
  tasks_completed: 2
  files_created: 11
  files_modified: 0
---

# Phase 4 Plan 02: Probe Tooling and Input Files Summary

**One-liner:** Generalized FOLIO coverage probe script (argparse `--area` slug) plus 9 verbatim lean-exemplar probe-items JSON files cross-checked against `data.ts`, validated by a structural Nyquist checker.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Generalize run_coverage_probe.py into run_probe.py | bc212d4 | scripts/demos/run_probe.py |
| 2 | Author 9 probe-items.json files and structural checker | 6a05110 | scripts/demos/verify_probe_items.py + 9 JSON files |

## What Was Built

**Task 1 — run_probe.py**

Generalized spike-001 `run_coverage_probe.py` into `scripts/demos/run_probe.py`:
- `argparse` `--area {slug}` (required) and `--limit N` (optional, default 20)
- Derives `ITEMS_FILE = SCRIPT_DIR/{slug}-probe-items.json` and `OUT_FILE = SCRIPT_DIR/{slug}-probe-candidates.json`
- `RELEVANT_BRANCHES` set and `_branch_of()` helper copied verbatim from spike
- Full FOLIO search loop, result dict fields, fan-out distribution summary preserved verbatim
- Per-item stderr line: `[idx] (level) {item:40s}  high≥90={count}` for operator eyeball
- Module docstring notes FOLIO OWL load behavior and backend venv run command
- Spike original at `.planning/spikes/001-demo-pi-curation/run_coverage_probe.py` untouched

**Task 2 — 9 probe-items.json files**

Created `{slug}-probe-items.json` for all 9 non-PI practice areas:
- `solo-criminal`, `family-law`, `employment-labor`, `corporate-ma`, `ip-tech`, `commercial-lit`, `real-estate`, `banking-finance`, `immigration`
- Each: 16 verbatim lean labels from `packages/core/src/exemplar/data.ts` in depth-first order (root → each branch → its 2 leaves)
- `item_level` arrays: exactly 1 `"root"`, 5 `"branch"`, 10 `"leaf"`; `item_level[0] == "root"`
- No enrichments (probe measures lean coverage only per RESEARCH.md)
- Labels copied character-for-character from `data.ts` (no paraphrasing, no case changes)

**Structural checker — verify_probe_items.py**

Loads all 9 files, asserts required keys, item count (16), level count (16), 1/5/10 distribution, and `item_level[0] == "root"`. Prints `PASS` and exits 0. Serves as the Nyquist automated gate for this plan.

## Verification

All three verification steps passed:
- `python3 -m py_compile scripts/demos/run_probe.py` — success
- `python3 scripts/demos/verify_probe_items.py` — prints `PASS`, exits 0
- `git diff .planning/spikes/001-demo-pi-curation/run_coverage_probe.py` — zero changes (spike untouched)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All 9 probe-items.json files contain the authoritative verbatim labels. The probe runner requires FOLIO network access at operator run time (by design — this is the probe step, not the curation step).

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. run_probe.py writes only to local SCRIPT_DIR (scripts/demos/); all content is public FOLIO labels with no secrets.

## Self-Check: PASSED

- scripts/demos/run_probe.py: FOUND
- scripts/demos/verify_probe_items.py: FOUND
- scripts/demos/solo-criminal-probe-items.json: FOUND
- scripts/demos/family-law-probe-items.json: FOUND
- scripts/demos/employment-labor-probe-items.json: FOUND
- scripts/demos/corporate-ma-probe-items.json: FOUND
- scripts/demos/ip-tech-probe-items.json: FOUND
- scripts/demos/commercial-lit-probe-items.json: FOUND
- scripts/demos/real-estate-probe-items.json: FOUND
- scripts/demos/banking-finance-probe-items.json: FOUND
- scripts/demos/immigration-probe-items.json: FOUND
- Commit bc212d4: FOUND
- Commit 6a05110: FOUND
