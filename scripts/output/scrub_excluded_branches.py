#!/usr/bin/env python3
"""One-off scrub: remove EXCLUDED_BRANCHES branch_groups from demo payloads.

A handful of curated demo payloads predate the pipeline-path EXCLUDED_BRANCHES
filter and still carry candidate branch_groups for sandbox / standards-
compatibility branches. They are never *selected* (asserted below), but a viewer
expanding the candidate tree sees an "UNDER CONSTRUCTION" branch — unpolished.

This removes every `mapping_response.items[].branch_groups[]` whose `branch` is
in EXCLUDED_BRANCHES and recomputes each item's `total_candidates`. If a removed
candidate's iri_hash happens to be a current selection (immigration item 10's
"460 Deportation (PACER NoS)" is the one known case), that orphaned hash is also
pruned from `selections`; the item keeps its other mappings, so `node_statuses`
and the `completed` count are unaffected.

The excluded set is sourced from backend/app/services/branch_config.py — never
hardcoded — so this stays in sync with the backend source of truth.

Usage:
    python3 scripts/output/scrub_excluded_branches.py            # apply
    python3 scripts/output/scrub_excluded_branches.py --dry-run  # report only
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMOS_DIR = REPO_ROOT / "apps" / "web" / "src" / "exemplar" / "demos"
BRANCH_CONFIG_PY = REPO_ROOT / "backend" / "app" / "services" / "branch_config.py"


def load_excluded_branches() -> frozenset[str]:
    """Load EXCLUDED_BRANCHES from branch_config.py without importing the backend."""
    spec = importlib.util.spec_from_file_location("branch_config", BRANCH_CONFIG_PY)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {BRANCH_CONFIG_PY}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.EXCLUDED_BRANCHES


def collect_selected_hashes(payload: dict) -> set[str]:
    """Gather every iri_hash referenced in the payload's selections dict."""
    selected: set[str] = set()
    selections = payload.get("selections") or {}
    for hashes in selections.values():
        if isinstance(hashes, list):
            selected.update(hashes)
    return selected


def prune_selections(payload: dict, hashes_to_drop: set[str]) -> int:
    """Remove the given iri_hashes from every item's selections list.

    Returns the number of selection entries dropped. node_statuses and the
    completed count are intentionally left alone — an item that still has at
    least one remaining selection stays completed.
    """
    dropped = 0
    selections = payload.get("selections") or {}
    for idx, hashes in selections.items():
        if not isinstance(hashes, list):
            continue
        kept = [h for h in hashes if h not in hashes_to_drop]
        dropped += len(hashes) - len(kept)
        selections[idx] = kept
    return dropped


def scrub_payload(payload: dict, excluded: frozenset[str]) -> tuple[int, list[str]]:
    """Remove excluded branch_groups in place. Returns (removed_count, removed_hashes)."""
    removed_groups = 0
    removed_hashes: list[str] = []

    items = (payload.get("mapping_response") or {}).get("items") or []
    for item in items:
        groups = item.get("branch_groups") or []
        kept = []
        for group in groups:
            if group.get("branch") in excluded:
                removed_groups += 1
                for cand in group.get("candidates") or []:
                    if cand.get("iri_hash"):
                        removed_hashes.append(cand["iri_hash"])
            else:
                kept.append(group)
        if len(kept) != len(groups):
            item["branch_groups"] = kept
            item["total_candidates"] = sum(len(g.get("candidates") or []) for g in kept)

    return removed_groups, removed_hashes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report only, do not write")
    args = parser.parse_args()

    excluded = load_excluded_branches()
    print(f"EXCLUDED_BRANCHES: {sorted(excluded)}\n")

    demo_files = sorted(DEMOS_DIR.glob("*.demo.json"))
    if not demo_files:
        print(f"No demo files found in {DEMOS_DIR}", file=sys.stderr)
        return 1

    total_removed = 0
    for path in demo_files:
        payload = json.loads(path.read_text())
        selected = collect_selected_hashes(payload)
        removed_groups, removed_hashes = scrub_payload(payload, excluded)

        if removed_groups == 0:
            print(f"  {path.name}: clean")
            continue

        # Any removed candidate that is also a current selection becomes orphaned;
        # prune it from selections so the demo stays internally consistent.
        conflicts = sorted(set(removed_hashes) & selected)
        pruned = prune_selections(payload, set(conflicts)) if conflicts else 0

        total_removed += removed_groups
        action = "would remove" if args.dry_run else "removed"
        detail = f"{len(removed_hashes)} candidates"
        if conflicts:
            detail += f", pruned {pruned} orphaned selection(s): {conflicts}"
        else:
            detail += ", 0 selected — safe"
        print(f"  {path.name}: {action} {removed_groups} excluded branch_group(s) ({detail})")

        if not args.dry_run:
            # Match the existing on-disk format: indent=2, escaped unicode, trailing newline.
            path.write_text(json.dumps(payload, indent=2) + "\n")

    print(
        f"\n{'DRY RUN — ' if args.dry_run else ''}"
        f"{total_removed} excluded branch_group(s) across {len(demo_files)} demos."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
