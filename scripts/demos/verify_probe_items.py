"""
Structural checker for probe-items JSON files.

Loads every {slug}-probe-items.json for the 9 demo areas and asserts each:
  - Has required keys: practice_area, source, items, item_level
  - items length == 16
  - item_level length == 16
  - Exactly 1 root, 5 branch, 10 leaf in item_level
  - item_level[0] == "root"

Prints PASS or the first failure, exits non-zero on any failure.

Run from project root:
    python3 scripts/demos/verify_probe_items.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

SLUGS = [
    "solo-criminal",
    "family-law",
    "employment-labor",
    "corporate-ma",
    "ip-tech",
    "commercial-lit",
    "real-estate",
    "banking-finance",
    "immigration",
]

REQUIRED_KEYS = {"practice_area", "source", "items", "item_level"}


def check(slug: str) -> str | None:
    """Return an error string on failure, or None on success."""
    path = SCRIPT_DIR / f"{slug}-probe-items.json"
    if not path.exists():
        return f"{slug}: file not found: {path}"

    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        return f"{slug}: invalid JSON: {exc}"

    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        return f"{slug}: missing keys: {sorted(missing)}"

    items = data["items"]
    levels = data["item_level"]

    if not isinstance(items, list):
        return f"{slug}: 'items' must be a list"
    if not isinstance(levels, list):
        return f"{slug}: 'item_level' must be a list"

    if len(items) != 16:
        return f"{slug}: expected 16 items, got {len(items)}"
    if len(levels) != 16:
        return f"{slug}: expected 16 levels, got {len(levels)}"

    valid = {"root", "branch", "leaf"}
    for i, level in enumerate(levels):
        if level not in valid:
            return f"{slug}: item_level[{i}] = {level!r} not in {sorted(valid)}"

    root_count = levels.count("root")
    branch_count = levels.count("branch")
    leaf_count = levels.count("leaf")

    if root_count != 1:
        return f"{slug}: expected 1 root, got {root_count}"
    if branch_count != 5:
        return f"{slug}: expected 5 branch, got {branch_count}"
    if leaf_count != 10:
        return f"{slug}: expected 10 leaf, got {leaf_count}"

    if levels[0] != "root":
        return f"{slug}: item_level[0] must be 'root', got {levels[0]!r}"

    return None


def main() -> int:
    all_passed = True
    for slug in SLUGS:
        error = check(slug)
        if error:
            print(f"FAIL: {error}", file=sys.stderr)
            all_passed = False

    if all_passed:
        print("PASS")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
