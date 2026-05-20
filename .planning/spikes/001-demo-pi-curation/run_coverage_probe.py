"""
Spike 001 — Personal Injury demo curation: FOLIO coverage probe (v2).

For each line of the existing lean PI exemplar (verbatim from
packages/core/src/exemplar/data.ts), search FOLIO and capture top candidates.
This measures what the demo session would look like if we ran the existing
exemplar through the live pipeline and saved the result.

Question: do enough items show ≥4-candidate fan-out to make the demo
visibly rich, or are too many items pinned at 1:1?

Run from project root via the backend venv:
    backend/.venv/bin/python .planning/spikes/001-demo-pi-curation/run_coverage_probe.py
"""

from __future__ import annotations

import json
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ITEMS_FILE = SCRIPT_DIR / "items.json"
OUT_FILE = SCRIPT_DIR / "candidates.json"

# Branches FOLIO uses for legally-substantive concepts. Used to count "relevant"
# candidates (vs. country/court/degree noise from fuzzy label match).
RELEVANT_BRANCHES = {
    "Objectives",
    "Area of Law",
    "Legal Entity",
    "Actor / Player",
    "Service",
    "Industry and Market",
    "Matter Narrative",
    "Standards Compatibility",
}


def main() -> int:
    print("Loading FOLIO ontology...", file=sys.stderr)
    t0 = time.time()
    from folio import FOLIO  # type: ignore[import-not-found]

    folio = FOLIO()
    print(f"FOLIO loaded in {time.time() - t0:.1f}s", file=sys.stderr)

    payload = json.loads(ITEMS_FILE.read_text())
    items: list[str] = payload["items"]
    levels: list[str] = payload["item_level"]

    results: list[dict[str, Any]] = []
    summary: dict[str, list[int]] = defaultdict(list)

    for idx, (item, level) in enumerate(zip(items, levels), start=1):
        # In the real pipeline, Stage 0 expands the item text into search terms.
        # For exemplar input where the line IS already a FOLIO-shaped label, the
        # label itself is the term. The pipeline's spaCy + embedding layers add
        # synonyms; for this probe we keep it lean — just the label.
        try:
            hits = folio.search_by_label(item, include_alt_labels=True, limit=20)
        except Exception as exc:  # noqa: BLE001
            print(f"  [item {idx}] search raised: {exc}", file=sys.stderr)
            continue

        candidates_by_iri: dict[str, dict[str, Any]] = {}
        for owl_class, score in hits:
            iri = getattr(owl_class, "iri", None) or ""
            if not iri:
                continue
            label = getattr(owl_class, "label", None) or ""
            if not label or label.lower() in {"thing", "owl#thing"}:
                continue
            branch = _branch_of(folio, owl_class)
            candidates_by_iri[iri] = {
                "iri": iri,
                "label": label,
                "score": float(score),
                "branch": branch,
                "definition": (getattr(owl_class, "definition", None) or "")[:160],
            }

        ranked = sorted(candidates_by_iri.values(), key=lambda c: c["score"], reverse=True)
        relevant = [c for c in ranked if c["branch"] in RELEVANT_BRANCHES]
        top_relevant = relevant[:8]
        high_relevant = [c for c in relevant if c["score"] >= 90.0]

        results.append({
            "index": idx,
            "item": item,
            "level": level,
            "total_candidates": len(ranked),
            "relevant_candidates": len(relevant),
            "high_score_relevant": len(high_relevant),
            "top_relevant": top_relevant,
            "branches_touched": sorted({c["branch"] for c in top_relevant}),
        })

        summary["relevant"].append(len(relevant))
        summary["high_relevant"].append(len(high_relevant))
        summary["branches"].append(len({c["branch"] for c in top_relevant}))

        print(
            f"  [{idx:2d}] ({level:6s}) {item:32s} total={len(ranked):2d}  "
            f"relevant={len(relevant):2d}  high≥90 (relevant)={len(high_relevant):2d}",
            file=sys.stderr,
        )

    OUT_FILE.write_text(json.dumps({"results": results}, indent=2))

    print("\n=== Fan-out distribution (relevant-branch candidates) ===", file=sys.stderr)
    buckets = {
        "1:1 (1 relevant cand)": sum(1 for n in summary["relevant"] if n <= 1),
        "1:2 (2 relevant cand)": sum(1 for n in summary["relevant"] if n == 2),
        "1:3 (3 relevant cand)": sum(1 for n in summary["relevant"] if n == 3),
        "1:4-5 (4-5 relevant)": sum(1 for n in summary["relevant"] if 4 <= n <= 5),
        "1:6+ (6 or more)": sum(1 for n in summary["relevant"] if n >= 6),
    }
    for label, count in buckets.items():
        print(f"  {label}: {count} items", file=sys.stderr)

    print(f"\nMean relevant cand per item: {sum(summary['relevant']) / len(summary['relevant']):.1f}", file=sys.stderr)
    print(f"Items at 1:1 or 1:2 (need enrichment?): "
          f"{sum(1 for n in summary['relevant'] if n <= 2)}/{len(summary['relevant'])}", file=sys.stderr)
    return 0


def _branch_of(folio: Any, owl_class: Any) -> str:
    current = owl_class
    visited = set()
    for _ in range(20):
        parents = getattr(current, "sub_class_of", None) or []
        if not parents:
            return getattr(current, "label", None) or ""
        parent_iri = parents[0] if isinstance(parents[0], str) else getattr(parents[0], "iri", "")
        if not parent_iri or parent_iri in visited:
            return getattr(current, "label", None) or ""
        visited.add(parent_iri)
        if "owl#Thing" in parent_iri or parent_iri.endswith("Thing"):
            return getattr(current, "label", None) or ""
        try:
            parent = folio[parent_iri]
        except Exception:  # noqa: BLE001
            return getattr(current, "label", None) or ""
        if parent is None:
            return getattr(current, "label", None) or ""
        current = parent
    return getattr(current, "label", None) or ""


if __name__ == "__main__":
    sys.exit(main())
