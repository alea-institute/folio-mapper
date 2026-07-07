"""Generate {slug}-probe-items.json for the v1.1 Phase 5 regulatory exemplars.

Parses each new exemplar's hierarchy from packages/core/src/exemplar/data.ts and
emits the probe-items file (items[] + item_level[] with tab-depth -> level) that
run_probe.py consumes. Matches the Phase 4 probe-items shape (1 root, 5 branch,
10 leaf).

Run from project root:
    backend/.venv/bin/python scripts/demos/gen_regulatory_probe_items.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_TS = REPO_ROOT / "packages" / "core" / "src" / "exemplar" / "data.ts"
OUT_DIR = Path(__file__).resolve().parent

SLUGS = [
    "environmental-compliance",
    "energy-utilities",
    "securities-regulation",
    "data-privacy",
]


def parse_lines(source: str, slug: str) -> list[tuple[str, str]]:
    m = re.search(rf"id:\s*'{re.escape(slug)}'.*?text:\s*\[(.*?)\]\.join", source, re.S)
    if not m:
        raise SystemExit(f"exemplar block not found for {slug!r}")
    block = m.group(1)
    out: list[tuple[str, str]] = []
    for raw in re.findall(r"'((?:[^'\\]|\\.)*)'", block):
        tabs = len(re.match(r"(?:\\t)*", raw).group(0)) // 2  # each \t is 2 chars
        label = raw.replace("\\t", "")
        level = {0: "root", 1: "branch", 2: "leaf"}[tabs]
        out.append((label, level))
    return out


def main() -> int:
    source = DATA_TS.read_text()
    for slug in SLUGS:
        lines = parse_lines(source, slug)
        items = [lbl for lbl, _ in lines]
        levels = [lvl for _, lvl in lines]
        payload = {
            "practice_area": slug,
            "source": f"packages/core/src/exemplar/data.ts (id: {slug})",
            "items": items,
            "item_level": levels,
        }
        out = OUT_DIR / f"{slug}-probe-items.json"
        out.write_text(json.dumps(payload, indent=2))
        print(f"wrote {out.name}: {len(items)} items "
              f"({levels.count('root')}r/{levels.count('branch')}b/{levels.count('leaf')}l)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
