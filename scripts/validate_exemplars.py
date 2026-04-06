#!/usr/bin/env python3
"""Validate exemplar terms against FOLIO search_by_label.

Runs each leaf term through folio-python's search_by_label and reports
scores. Terms scoring >= 60 are 'good', 40-59 are 'marginal', < 40 are 'miss'.

Usage: python scripts/validate_exemplars.py
"""

import json
import re
import sys
from pathlib import Path

from folio import FOLIO


def parse_exemplars_from_ts(filepath: str) -> list[dict]:
    """Parse exemplar text blocks from the TypeScript data file."""
    content = Path(filepath).read_text()
    exemplars = []

    # Find each exemplar block
    pattern = r"id:\s*'([^']+)'.*?label:\s*'([^']+)'.*?text:\s*\[(.*?)\]\.join"
    for match in re.finditer(pattern, content, re.DOTALL):
        ex_id = match.group(1)
        label = match.group(2)
        lines_raw = match.group(3)

        # Extract string literals
        lines = re.findall(r"'([^']*)'", lines_raw)
        text = "\n".join(lines)

        # Parse leaf terms (deepest level items — those with most tabs)
        # In the TS source, tabs are literal \t sequences
        leaf_terms = []
        for line in lines:
            # Count leading \t sequences
            depth = 0
            pos = 0
            while line[pos:pos+2] == "\\t":
                depth += 1
                pos += 2
            if depth == 2:  # Leaf level
                leaf_terms.append(line[pos:])

        exemplars.append({
            "id": ex_id,
            "label": label,
            "text": text,
            "leaf_terms": leaf_terms,
        })

    return exemplars


def validate_term(folio: FOLIO, term: str) -> dict:
    """Search FOLIO for a term and return validation info."""
    results = folio.search_by_label(term, include_alt_labels=True, limit=5)

    # Also check exact label match (get_by_label returns a list)
    exact = folio.get_by_label(term)
    is_exact = bool(exact)

    # Check alt label match
    alt_matches = folio.get_by_alt_label(term)
    is_alt = bool(alt_matches)

    if is_exact:
        label = exact[0].label if isinstance(exact, list) else exact.label
        return {
            "term": term,
            "match_type": "exact",
            "best_label": label,
            "score": 100,
            "status": "good",
        }

    if is_alt:
        label = alt_matches[0].label if isinstance(alt_matches, list) else alt_matches.label
        return {
            "term": term,
            "match_type": "alt_label",
            "best_label": label,
            "score": 100,
            "status": "good",
        }

    if results:
        best = results[0]
        score = best[1]
        # Filter out false positives (countries, courts, etc.)
        # by checking word overlap
        term_words = set(term.lower().split())
        label_words = set(best[0].label.lower().split())
        overlap = term_words & label_words
        # If high score but no word overlap, it's likely a false positive
        if score >= 90 and not overlap and len(term_words) > 1:
            # Try to find a better match with word overlap
            for cls, s in results[1:]:
                lw = set(cls.label.lower().split())
                if term_words & lw:
                    return {
                        "term": term,
                        "match_type": "fuzzy_overlap",
                        "best_label": cls.label,
                        "score": s,
                        "status": "good" if s >= 60 else "marginal" if s >= 40 else "miss",
                    }
            # No good overlap found
            return {
                "term": term,
                "match_type": "fuzzy_no_overlap",
                "best_label": best[0].label,
                "score": score,
                "status": "marginal",  # High fuzzy score but no word overlap = suspicious
            }

        status = "good" if score >= 60 else "marginal" if score >= 40 else "miss"
        return {
            "term": term,
            "match_type": "fuzzy",
            "best_label": best[0].label,
            "score": score,
            "status": status,
        }

    return {
        "term": term,
        "match_type": "none",
        "best_label": "",
        "score": 0,
        "status": "miss",
    }


def main():
    data_file = Path(__file__).parent.parent / "packages/core/src/exemplar/data.ts"
    if not data_file.exists():
        print(f"ERROR: {data_file} not found")
        sys.exit(1)

    print("Loading FOLIO ontology...")
    folio = FOLIO()
    print(f"Loaded {len(folio.classes)} classes\n")

    exemplars = parse_exemplars_from_ts(str(data_file))
    print(f"Found {len(exemplars)} exemplars\n")

    all_results = []
    overall_good = 0
    overall_marginal = 0
    overall_miss = 0
    overall_total = 0

    for ex in exemplars:
        print(f"{'=' * 60}")
        print(f"  {ex['label']} ({ex['id']})")
        print(f"{'=' * 60}")

        good = 0
        marginal = 0
        miss = 0
        results = []

        for term in ex["leaf_terms"]:
            result = validate_term(folio, term)
            results.append(result)

            icon = {"good": "✓", "marginal": "~", "miss": "✗"}[result["status"]]
            match_info = f"[{result['match_type']}]"
            if result["best_label"] and result["best_label"] != term:
                match_info += f" → {result['best_label']}"
            print(f"  {icon} {result['score']:3.0f}  {term}  {match_info}")

            if result["status"] == "good":
                good += 1
            elif result["status"] == "marginal":
                marginal += 1
            else:
                miss += 1

        total = len(ex["leaf_terms"])
        hit_rate = (good / total * 100) if total > 0 else 0
        print(f"\n  Summary: {good}/{total} good ({hit_rate:.0f}%), {marginal} marginal, {miss} miss")
        print()

        overall_good += good
        overall_marginal += marginal
        overall_miss += miss
        overall_total += total

        all_results.append({
            "id": ex["id"],
            "label": ex["label"],
            "total": total,
            "good": good,
            "marginal": marginal,
            "miss": miss,
            "hit_rate": hit_rate,
            "results": results,
        })

    # Overall summary
    overall_hit_rate = (overall_good / overall_total * 100) if overall_total > 0 else 0
    print(f"{'=' * 60}")
    print(f"  OVERALL: {overall_good}/{overall_total} good ({overall_hit_rate:.0f}%)")
    print(f"  Marginal: {overall_marginal}, Miss: {overall_miss}")
    print(f"{'=' * 60}")

    # Flag problems
    problems = []
    for ex_result in all_results:
        if ex_result["hit_rate"] < 80:
            problems.append(f"  ⚠ {ex_result['label']}: {ex_result['hit_rate']:.0f}% hit rate")
        for r in ex_result["results"]:
            if r["status"] == "miss":
                problems.append(f"  ✗ {ex_result['label']}: '{r['term']}' — no good match")

    if problems:
        print("\nISSUES TO ADDRESS:")
        for p in problems:
            print(p)

    # Save report
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    report_path = output_dir / "validation_report.json"
    with open(report_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nReport saved to {report_path}")

    return 0 if overall_hit_rate >= 80 else 1


if __name__ == "__main__":
    sys.exit(main())
