"""
Spike 001 — Personal Injury demo curation: FOLIO coverage probe.

For each of the 15 PI items, extract plausible FOLIO search terms and run
folio-python's label search. Capture the top candidates per item, then
write candidates.json for review.

Run from project root via the backend venv:
    backend/.venv/bin/python .planning/spikes/001-demo-pi-curation/run_coverage_probe.py

This is the LLM-free portion of the pipeline (Stage 1). The "would Stages 0/2/3
surface these?" question is answered by inspecting candidates.json with judgment.
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
ITEMS_FILE = SCRIPT_DIR / "items.json"
OUT_FILE = SCRIPT_DIR / "candidates.json"

# Per-item handcrafted search terms. Mirrors what Stage 0 (LLM segmentation +
# branch tagging) would produce; doing it manually here keeps the spike free of
# LLM calls. Each list is a small set of multi-word phrases that the item's
# narrative would reasonably elicit.
TERMS_PER_ITEM: list[list[str]] = [
    # 1. Rear-ended texting driver
    ["motor vehicle accident", "distracted driving", "whiplash", "pain and suffering", "lost wages"],
    # 2. Slip and fall grocery
    ["premises liability", "slip and fall", "negligence", "hip fracture", "medical damages"],
    # 3. Birth injury / wrongful death
    ["medical malpractice", "obstetric negligence", "wrongful death", "birth injury", "hypoxic ischemic encephalopathy"],
    # 4. Pressure cooker explosion
    ["product liability", "defective product", "failure to recall", "burn injury", "emotional distress"],
    # 5. Mass tort groundwater contamination
    ["mass tort", "environmental contamination", "toxic exposure", "leukemia", "class action"],
    # 6. Pedestrian struck, DUI driver
    ["motor vehicle accident", "pedestrian accident", "negligence per se", "traumatic brain injury", "future care damages"],
    # 7. Broken stair landlord notice
    ["premises liability", "landlord liability", "negligence", "loss of earning capacity", "personal injury"],
    # 8. Wrong-site surgery
    ["medical malpractice", "surgical error", "wrong site surgery", "informed consent", "nerve damage"],
    # 9. Rollover roof crush
    ["product liability", "automotive defect", "wrongful death", "crashworthiness", "punitive damages"],
    # 10. Burn pits class
    ["mass tort", "toxic tort", "government contractor", "class certification", "respiratory disease"],
    # 11. Uninsured motorist denial
    ["motor vehicle accident", "uninsured motorist", "insurance bad faith", "policy interpretation", "claim denial"],
    # 12. Hotel security assault
    ["premises liability", "negligent security", "sexual assault", "innkeeper duty", "foreseeable harm"],
    # 13. Nursing home pressure ulcer
    ["elder abuse", "nursing home negligence", "neglect", "sepsis", "regulatory violation"],
    # 14. Playground collapse
    ["product liability", "design defect", "child injury", "manufacturer negligence", "skull fracture"],
    # 15. Asbestos mesothelioma
    ["asbestos", "mesothelioma", "toxic tort", "premises liability", "successor liability"],
]


def load_items() -> list[str]:
    data = json.loads(ITEMS_FILE.read_text())
    return data["items"]


def main() -> int:
    print("Loading FOLIO ontology (may take 5-15s on first run)...", file=sys.stderr)
    t0 = time.time()
    from folio import FOLIO  # type: ignore[import-not-found]

    folio = FOLIO()
    print(f"FOLIO loaded in {time.time() - t0:.1f}s", file=sys.stderr)

    items = load_items()
    if len(items) != len(TERMS_PER_ITEM):
        print(f"Mismatch: {len(items)} items vs {len(TERMS_PER_ITEM)} term lists", file=sys.stderr)
        return 1

    results: list[dict[str, Any]] = []
    summary: dict[str, list[int]] = defaultdict(list)

    for idx, (item, terms) in enumerate(zip(items, TERMS_PER_ITEM), start=1):
        candidates_by_iri: dict[str, dict[str, Any]] = {}

        for term in terms:
            try:
                hits = folio.search_by_label(term, include_alt_labels=True, limit=12)
            except Exception as exc:  # noqa: BLE001
                print(f"  [item {idx}] term '{term}' raised: {exc}", file=sys.stderr)
                continue

            for owl_class, score in hits:
                iri = getattr(owl_class, "iri", None) or ""
                if not iri:
                    continue
                # Skip top-level/meta classes
                label = getattr(owl_class, "label", None) or ""
                if not label or label.lower() in {"thing", "owl#thing"}:
                    continue

                if iri in candidates_by_iri:
                    existing = candidates_by_iri[iri]
                    if score > existing["score"]:
                        existing["score"] = score
                        existing["matched_term"] = term
                else:
                    branch = _branch_of(folio, owl_class)
                    candidates_by_iri[iri] = {
                        "iri": iri,
                        "label": label,
                        "score": float(score),
                        "matched_term": term,
                        "branch": branch,
                        "definition": (getattr(owl_class, "definition", None) or "")[:200],
                    }

        ranked = sorted(candidates_by_iri.values(), key=lambda c: c["score"], reverse=True)
        top = ranked[:12]
        high_conf = [c for c in top if c["score"] >= 75.0]
        medium_conf = [c for c in top if 50.0 <= c["score"] < 75.0]

        results.append({
            "index": idx,
            "item": item,
            "search_terms": terms,
            "total_candidates": len(ranked),
            "high_confidence_count": len(high_conf),
            "medium_confidence_count": len(medium_conf),
            "branches_touched": sorted({c["branch"] for c in top if c["branch"]}),
            "top_candidates": top,
        })

        summary["high"].append(len(high_conf))
        summary["medium"].append(len(medium_conf))
        summary["branches"].append(len({c["branch"] for c in top if c["branch"]}))

        print(
            f"  [item {idx:2d}] total={len(ranked):3d}  high(≥75)={len(high_conf):2d}  "
            f"med(50-74)={len(medium_conf):2d}  branches={len({c['branch'] for c in top if c['branch']})}",
            file=sys.stderr,
        )

    OUT_FILE.write_text(json.dumps({"results": results}, indent=2))

    print("\n=== Coverage Summary ===", file=sys.stderr)
    print(f"Items with ≥4 high-confidence candidates: {sum(1 for n in summary['high'] if n >= 4)}/15", file=sys.stderr)
    print(f"Items with ≥4 high+medium candidates:     {sum(1 for n, m in zip(summary['high'], summary['medium']) if n + m >= 4)}/15", file=sys.stderr)
    print(f"Mean branches touched per item:           {sum(summary['branches']) / 15:.1f}", file=sys.stderr)
    print(f"\nWrote {OUT_FILE.relative_to(SCRIPT_DIR.parent.parent.parent)}", file=sys.stderr)
    return 0


def _branch_of(folio: Any, owl_class: Any) -> str:
    """Walk sub_class_of chain to root, return branch label."""
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
