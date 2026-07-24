#!/usr/bin/env python3
"""Classified-delta comparator for the folio-mapper -> folio-resolve migration.

Diffs two captures written by ``harness.py`` and buckets every difference, then runs the
migration canaries. Exits non-zero if a canary fails.

Buckets
-------
* ``term_delta``   — ``_generate_search_terms`` / tokenization output changed
* ``score_delta``  — a fixed query/label pair scores differently
* ``set_delta``    — a search seam gained or lost candidates
* ``rank_delta``   — the same candidate set came back with different scores/ordering

Canaries
--------
1. **PARITY** — folio-mapper's swap is a pure internals swap onto the pinned library, so the
   expected delta is *empty*. Any bucket with rows fails the canary unless ``--expect-changes``
   is passed (used only when a change is deliberate and documented in ``DELTA-REPORT.md``).
2. **PLACES-PRESERVED** — mapper maps arbitrary taxonomies, so place/jurisdiction rows are
   legitimate targets. The library's ``PlaceNameGate`` (right for folio-enrich's prose tagging)
   must NOT leak in here: place-category top-1 results must survive.
3. **STOPWORD-FALLBACK** — all-stopword inputs must keep hitting the ``_tokenize()`` fallback
   (i.e. their candidate counts must not collapse to zero where the baseline had rows).

Usage::

    .venv/bin/python migration/compare.py --baseline baseline --candidate candidate
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

MIGRATION = Path(__file__).resolve().parent
CAPTURES_DIR = MIGRATION / "captures"


def _load(name: str) -> dict[str, Any]:
    return json.loads((CAPTURES_DIR / f"{name}.json").read_text())


def _by_id(rows: list[dict], key: str = "id") -> dict[str, dict]:
    return {r[key]: r for r in rows}


def _rowset(top: list[dict]) -> set[tuple[str, float]]:
    return {(r["iri_hash"], r["score"]) for r in top}


def diff_tokenization(base: dict, cand: dict) -> list[dict]:
    out: list[dict] = []
    b = {r["text"]: r for r in base["tokenization"]}
    c = {r["text"]: r for r in cand["tokenization"]}
    for text, brow in b.items():
        crow = c.get(text)
        if crow is None:
            out.append({"bucket": "term_delta", "seam": "tokenization", "id": text, "detail": "missing in candidate"})
            continue
        if brow["tokens"] != crow["tokens"] or brow["content_words"] != crow["content_words"]:
            out.append(
                {
                    "bucket": "term_delta",
                    "seam": "tokenization",
                    "id": text,
                    "baseline": {"tokens": brow["tokens"], "content_words": brow["content_words"]},
                    "candidate": {"tokens": crow["tokens"], "content_words": crow["content_words"]},
                }
            )
    return out


def diff_search_terms(base: dict, cand: dict) -> list[dict]:
    out: list[dict] = []
    b, c = _by_id(base["search_terms"]), _by_id(cand["search_terms"])
    for rid, brow in b.items():
        crow = c.get(rid)
        if crow is None:
            out.append({"bucket": "term_delta", "seam": "search_terms", "id": rid, "detail": "missing in candidate"})
            continue
        if brow["terms"] != crow["terms"]:
            bset, cset = set(brow["terms"]), set(crow["terms"])
            out.append(
                {
                    "bucket": "term_delta",
                    "seam": "search_terms",
                    "id": rid,
                    "text": brow["text"],
                    "added": sorted(cset - bset),
                    "removed": sorted(bset - cset),
                    "reordered": bset == cset,
                }
            )
    return out


def diff_score_pairs(base: dict, cand: dict) -> list[dict]:
    out: list[dict] = []
    b, c = _by_id(base["score_pairs"]), _by_id(cand["score_pairs"])
    for rid, brow in b.items():
        crow = c.get(rid)
        if crow is None:
            out.append({"bucket": "score_delta", "seam": "score_pairs", "id": rid, "detail": "missing in candidate"})
            continue
        if brow["score"] != crow["score"]:
            out.append(
                {
                    "bucket": "score_delta",
                    "seam": "score_pairs",
                    "id": rid,
                    "query": brow["query"],
                    "label": brow["label"],
                    "baseline": brow["score"],
                    "candidate": crow["score"],
                }
            )
    return out


def _diff_candidate_seam(seam: str, base_rows: list[dict], cand_rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    b, c = _by_id(base_rows), _by_id(cand_rows)
    for rid, brow in b.items():
        crow = c.get(rid)
        if crow is None:
            out.append({"bucket": "set_delta", "seam": seam, "id": rid, "detail": "missing in candidate"})
            continue
        if brow.get("total") != crow.get("total"):
            out.append(
                {
                    "bucket": "set_delta",
                    "seam": seam,
                    "id": rid,
                    "text": brow.get("text"),
                    "baseline_total": brow.get("total"),
                    "candidate_total": crow.get("total"),
                }
            )
        bt, ct = brow.get("top", []), crow.get("top", [])
        if _rowset(bt) != _rowset(ct):
            bkeys = {r["iri_hash"] for r in bt}
            ckeys = {r["iri_hash"] for r in ct}
            out.append(
                {
                    "bucket": "rank_delta",
                    "seam": seam,
                    "id": rid,
                    "text": brow.get("text"),
                    "gained": sorted(
                        (r["label"], r["score"]) for r in ct if r["iri_hash"] not in bkeys
                    ),
                    "lost": sorted(
                        (r["label"], r["score"]) for r in bt if r["iri_hash"] not in ckeys
                    ),
                    "rescored": sorted(
                        (r["label"], r["score"], next(x["score"] for x in ct if x["iri_hash"] == r["iri_hash"]))
                        for r in bt
                        if r["iri_hash"] in ckeys
                        and next(x["score"] for x in ct if x["iri_hash"] == r["iri_hash"]) != r["score"]
                    ),
                }
            )
    return out


def canary_places(base: dict, cand: dict) -> list[str]:
    failures: list[str] = []
    b, c = _by_id(base["search"]), _by_id(cand["search"])
    for rid, brow in b.items():
        if brow.get("category") != "place":
            continue
        crow = c.get(rid, {})
        btop = brow.get("top") or []
        ctop = crow.get("top") or []
        if btop and not ctop:
            failures.append(f"PLACES-PRESERVED: {rid} ({brow['text']}) lost every candidate")
            continue
        if btop and ctop and btop[0]["iri_hash"] != ctop[0]["iri_hash"]:
            failures.append(
                f"PLACES-PRESERVED: {rid} top-1 changed {btop[0]['label']!r} -> {ctop[0]['label']!r} "
                "(a place gate must not be applied in folio-mapper)"
            )
    return failures


def canary_stopword_fallback(base: dict, cand: dict) -> list[str]:
    failures: list[str] = []
    b, c = _by_id(base["search"]), _by_id(cand["search"])
    for rid, brow in b.items():
        if brow.get("category") != "stopword_only":
            continue
        crow = c.get(rid, {})
        if brow.get("total", 0) > 0 and crow.get("total", 0) == 0:
            failures.append(
                f"STOPWORD-FALLBACK: {rid} ({brow['text']}) collapsed to zero candidates — "
                "the all-stopword _tokenize() fallback is broken"
            )
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", default="baseline")
    parser.add_argument("--candidate", default="candidate")
    parser.add_argument(
        "--expect-changes",
        action="store_true",
        help="allow a non-empty delta (use only for a deliberate, documented behavior change)",
    )
    parser.add_argument("--report", default=str(MIGRATION / "DELTA-REPORT.md"))
    args = parser.parse_args()

    base, cand = _load(args.baseline), _load(args.candidate)
    if base["corpus_hash"] != cand["corpus_hash"]:
        print("FATAL: captures came from different corpora (corpus_hash mismatch)")
        return 2

    deltas: list[dict] = []
    deltas += diff_tokenization(base, cand)
    deltas += diff_search_terms(base, cand)
    deltas += diff_score_pairs(base, cand)
    deltas += _diff_candidate_seam("search", base["search"], cand["search"])
    deltas += _diff_candidate_seam("mandatory", base["mandatory"], cand["mandatory"])
    deltas += _diff_candidate_seam("branch_scoped", base["branch_scoped"], cand["branch_scoped"])

    failures = canary_places(base, cand) + canary_stopword_fallback(base, cand)
    if deltas and not args.expect_changes:
        failures.append(f"PARITY: expected an empty delta, got {len(deltas)} row(s)")

    buckets: dict[str, int] = {}
    for d in deltas:
        buckets[d["bucket"]] = buckets.get(d["bucket"], 0) + 1

    payload = {
        "baseline": args.baseline,
        "candidate": args.candidate,
        "baseline_env": base["env"],
        "candidate_env": cand["env"],
        "buckets": buckets,
        "deltas": deltas,
        "canary_failures": failures,
    }
    (CAPTURES_DIR / "delta.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")

    lines = [
        "# folio-mapper -> folio-resolve migration — delta report",
        "",
        f"- baseline capture: `{args.baseline}` (folio-resolve consumed: "
        f"`{base['env'].get('folio_resolve_consumed', False)}`)",
        f"- candidate capture: `{args.candidate}` (folio-resolve consumed: "
        f"`{cand['env'].get('folio_resolve_consumed', False)}`, version "
        f"`{cand['env'].get('folio_resolve_version')}`)",
        f"- corpus hash: `{base['corpus_hash'][:16]}…`",
        "",
        "## Buckets",
        "",
    ]
    if buckets:
        lines += [f"- **{k}** — {v}" for k, v in sorted(buckets.items())]
    else:
        lines.append("- _(empty — byte-for-byte behavior parity)_")
    lines += ["", "## Canaries", ""]
    if failures:
        lines += [f"- ❌ {f}" for f in failures]
    else:
        lines += [
            "- ✅ PARITY — zero deltas across all six seams",
            "- ✅ PLACES-PRESERVED — place/jurisdiction rows still resolve (no PlaceNameGate leak)",
            "- ✅ STOPWORD-FALLBACK — all-stopword inputs keep their `_tokenize()` fallback",
        ]
    if deltas:
        lines += ["", "## Deltas", "", "```json", json.dumps(deltas[:50], indent=2), "```"]
    Path(args.report).write_text("\n".join(lines) + "\n")

    print(f"buckets: {buckets or '{} (empty delta)'}")
    for f in failures:
        print(f"CANARY FAIL: {f}")
    print(f"wrote {args.report} and {CAPTURES_DIR / 'delta.json'}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
