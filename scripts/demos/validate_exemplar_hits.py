"""100%-hit-rate gate for the v1.1 Phase 5 regulatory exemplars.

For every LEAF line (two-tab indent) of each new regulatory exemplar, assert the
label resolves to a PRECISE, UNIQUELY-labelled FOLIO concept:
  - folio.get_by_label(label) returns exactly one concept whose primary label
    equals the leaf text (case-insensitive), AND
  - folio.search_by_label(label) ranks that same concept first at score 100.

This mirrors ROADMAP Phase 5 Success Criterion 3 (no "best-available" / partial
matches). Runs LLM-free against folio-python (deterministic, near-zero cost).

Run from project root via the backend venv:
    backend/.venv/bin/python scripts/demos/validate_exemplar_hits.py

Exits non-zero if any leaf fails the exact-hit gate.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_TS = REPO_ROOT / "packages" / "core" / "src" / "exemplar" / "data.ts"

# Slugs authored in Phase 5 (regulatory / compliance).
NEW_SLUGS = [
    "environmental-compliance",
    "energy-utilities",
    "securities-regulation",
    "data-privacy",
]


def parse_exemplar_leaves(source: str, slug: str) -> list[str]:
    """Extract two-tab (leaf) labels from an exemplar's `text: [...]` array."""
    # Find the object block for this slug.
    m = re.search(rf"id:\s*'{re.escape(slug)}'.*?text:\s*\[(.*?)\]\.join", source, re.S)
    if not m:
        raise SystemExit(f"Could not locate exemplar block for slug {slug!r}")
    block = m.group(1)
    leaves: list[str] = []
    for raw in re.findall(r"'((?:[^'\\]|\\.)*)'", block):
        # Leaf lines start with exactly two escaped tabs (\t\t) and no third.
        if raw.startswith("\\t\\t") and not raw.startswith("\\t\\t\\t"):
            label = raw[len("\\t\\t"):]
            leaves.append(label)
    return leaves


def main() -> int:
    source = DATA_TS.read_text()

    print("Loading FOLIO ontology...", file=sys.stderr)
    from folio import FOLIO  # type: ignore[import-not-found]

    folio = FOLIO()

    def ancestor_iris(iri: str) -> set[str]:
        """All ancestor IRIs of a concept (transitive get_parents walk)."""
        out: set[str] = set()
        frontier = [iri]
        for _ in range(40):
            nxt = []
            for cur in frontier:
                for p in folio.get_parents(cur):
                    pi = getattr(p, "iri", None)
                    if pi and pi not in out:
                        out.add(pi)
                        nxt.append(pi)
            if not nxt:
                break
            frontier = nxt
        return out

    total = 0
    failures: list[str] = []
    for slug in NEW_SLUGS:
        leaves = parse_exemplar_leaves(source, slug)
        if len(leaves) != 10:
            failures.append(f"{slug}: expected 10 leaves, parsed {len(leaves)}")
        print(f"\n=== {slug} ({len(leaves)} leaves) ===")

        # Anti-circularity gate: no leaf may be an ancestor of another leaf
        # (listing a parent concept alongside its own children reads as a taxonomy
        # error — flagged by the Phase 5 ontology critique).
        leaf_iris: dict[str, str] = {}
        for leaf in leaves:
            r = folio.get_by_label(leaf)
            n = r if isinstance(r, list) else ([r] if r else [])
            if n and len(n) == 1:
                leaf_iris[leaf] = getattr(n[0], "iri", "")
        for leaf, iri in leaf_iris.items():
            if not iri:
                continue
            ancestors = ancestor_iris(iri)
            for other, oiri in leaf_iris.items():
                if other != leaf and oiri and oiri in ancestors:
                    failures.append(
                        f"{slug} :: CIRCULARITY — leaf {leaf!r} is a descendant of "
                        f"co-leaf {other!r}")
                    print(f"  [FAIL] CIRCULARITY   {leaf} < {other}")

        for leaf in leaves:
            total += 1
            status = "OK"
            detail = ""

            try:
                exact = folio.get_by_label(leaf)
            except Exception as exc:  # noqa: BLE001
                exact = None
                detail = f"get_by_label raised {exc}"
            nodes = exact if isinstance(exact, list) else ([exact] if exact else [])

            if not nodes:
                status = "MISS"
            elif len(nodes) > 1:
                status = "AMBIGUOUS"
                detail = f"{len(nodes)} concepts share this label"
            else:
                node = nodes[0]
                if (getattr(node, "label", "") or "").strip().lower() != leaf.lower():
                    status = "LABEL-MISMATCH"
                    detail = f"resolved to {getattr(node, 'label', '')!r}"
                else:
                    # Confirm the pipeline's search ranks it first at 100.
                    hits = folio.search_by_label(leaf, include_alt_labels=True, limit=1)
                    if not hits:
                        status = "NO-SEARCH-HIT"
                    else:
                        top, score = hits[0]
                        if (getattr(top, "iri", "") != getattr(node, "iri", "")):
                            status = "SEARCH-RANK"
                            detail = f"top search hit is {getattr(top, 'label', '')!r} ({score:.0f})"
                        elif score < 100.0:
                            status = "LOW-SCORE"
                            detail = f"top score {score:.1f} < 100"

            flag = "PASS" if status == "OK" else "FAIL"
            if flag == "FAIL":
                failures.append(f"{slug} :: {leaf} -> {status} {detail}")
            print(f"  [{flag}] {status:14s} {leaf:55s} {detail}")

    print("\n" + "=" * 60)
    print(f"Checked {total} leaves across {len(NEW_SLUGS)} exemplars.")
    if failures:
        print(f"FAILED: {len(failures)} leaf/leaves did not pass the 100%-hit gate:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS: every leaf resolves to a precise, unique FOLIO concept (100% hit rate).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
