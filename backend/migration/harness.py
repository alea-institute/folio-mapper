#!/usr/bin/env python3
"""Golden-baseline harness for the folio-mapper -> folio-resolve migration.

Runs the committed synthetic corpus (``migration/corpus.json``) through folio-mapper's
DETERMINISTIC matching seams and writes a capture file. Rerun before and after the
internals swap; ``migration/compare.py`` buckets the delta.

Seams exercised (all deterministic — $0 LLM spend, no embedding index required):

  1. ``tokenization``    -> ``folio_service._tokenize`` / ``_content_words``
  2. ``search_terms``    -> ``folio_service._generate_search_terms``
  3. ``score_pairs``     -> ``folio_service._compute_relevance_score`` (fixed query/label pairs)
  4. ``search``          -> ``folio_service.search_candidates`` (the whole Phase 1-4 path)
  5. ``mandatory``       -> ``search_candidates(..., mandatory_branches=[...])`` (Phase 2.7)
  6. ``branch_scoped``   -> ``pipeline.stage1_filter._search_within_branch`` (LLM-pipeline seam)

Usage::

    .venv/bin/python migration/harness.py --out baseline
    .venv/bin/python migration/harness.py --out candidate

Writes ``migration/captures/<out>.json`` and pins the corpus content hash into it so
``compare.py`` can refuse to diff captures taken from different corpora.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

# Run from anywhere: make `app` importable.
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

MIGRATION = Path(__file__).resolve().parent
CORPUS_PATH = MIGRATION / "corpus.json"
CAPTURES_DIR = MIGRATION / "captures"

# Fixed knobs so captures are comparable run to run.
THRESHOLD = 0.3
MAX_PER_BRANCH = 8
TOP_N = 10


def _corpus_hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _env() -> dict[str, Any]:
    from app.services import nlp

    # Is the library merely installed, or actually consumed by the backend? Identity of the
    # shared stopword set is the honest test: after the swap folio_service re-exports the
    # library's object rather than owning a fork of it.
    from app.services import folio_service

    try:
        import folio_resolve

        resolve_present = True
        resolve_version = folio_resolve.__version__
        resolve_consumed = folio_service.SEARCH_STOPWORDS is folio_resolve.SEARCH_STOPWORDS
    except ImportError:
        resolve_present = False
        resolve_version = None
        resolve_consumed = False

    try:
        from importlib.metadata import version as _pkg_version

        folio_python_version = _pkg_version("folio-python")
    except Exception:  # pragma: no cover - metadata is best effort
        folio_python_version = None

    embedding_active = False
    try:
        from app.services.embedding.service import get_embedding_index

        embedding_active = get_embedding_index() is not None
    except Exception:
        embedding_active = False

    return {
        "folio_resolve_present": resolve_present,
        "folio_resolve_consumed": resolve_consumed,
        "folio_resolve_version": resolve_version,
        "folio_python_version": folio_python_version,
        "nlp_available": nlp.is_available(),
        "embedding_index_active": embedding_active,
        "threshold": THRESHOLD,
        "max_per_branch": MAX_PER_BRANCH,
        "top_n": TOP_N,
    }


def run_tokenization(corpus: dict) -> list[dict]:
    from app.services.folio_service import _content_words, _tokenize

    return [
        {
            "text": text,
            "tokens": _tokenize(text),
            "content_words": sorted(_content_words(text)),
        }
        for text in corpus.get("tokenization", [])
    ]


def run_search_terms(corpus: dict) -> list[dict]:
    from app.services.folio_service import _generate_search_terms

    return [
        {
            "id": item["id"],
            "text": item["text"],
            "category": item["category"],
            "terms": _generate_search_terms(item["text"]),
        }
        for item in corpus.get("terms", [])
    ]


def run_score_pairs(corpus: dict) -> list[dict]:
    from app.services.folio_service import _compute_relevance_score, _content_words

    out: list[dict] = []
    for pair in corpus.get("score_pairs", []):
        query = pair["query"]
        score = _compute_relevance_score(
            _content_words(query),
            query,
            pair["label"],
            pair["definition"],
            list(pair["synonyms"]),
            preferred_label=pair["preferred_label"],
        )
        out.append({"id": pair["id"], "query": query, "label": pair["label"], "score": score})
    return out


def _candidate_rows(candidates: list[Any], limit: int = TOP_N) -> list[dict]:
    rows = [
        {
            "iri_hash": c.iri_hash,
            "label": c.label,
            "branch": c.branch,
            "score": c.score,
        }
        for c in candidates
    ]
    # search_candidates emits branch-grouped output in score order; sort for a stable capture.
    rows.sort(key=lambda r: (-r["score"], r["branch"], r["label"], r["iri_hash"]))
    return rows[:limit]


def run_search(corpus: dict) -> list[dict]:
    from app.services.folio_service import search_candidates

    out: list[dict] = []
    for item in corpus.get("terms", []):
        candidates = search_candidates(
            item["text"],
            threshold=THRESHOLD,
            max_per_branch=MAX_PER_BRANCH,
            use_bridging=True,
        )
        out.append(
            {
                "id": item["id"],
                "text": item["text"],
                "category": item["category"],
                "total": len(candidates),
                "top": _candidate_rows(candidates),
            }
        )
    return out


def run_mandatory(corpus: dict) -> list[dict]:
    from app.services.folio_service import search_candidates

    out: list[dict] = []
    for item in corpus.get("mandatory", []):
        candidates = search_candidates(
            item["text"],
            threshold=THRESHOLD,
            max_per_branch=MAX_PER_BRANCH,
            use_bridging=False,
            mandatory_branches=list(item["branches"]),
        )
        in_branch = [c for c in candidates if c.branch in set(item["branches"])]
        out.append(
            {
                "id": item["id"],
                "text": item["text"],
                "branches": list(item["branches"]),
                "total": len(candidates),
                "in_branch_total": len(in_branch),
                "top": _candidate_rows(in_branch),
            }
        )
    return out


def run_branch_scoped(corpus: dict) -> list[dict]:
    from app.services.folio_service import _resolve_branch_children, get_folio
    from app.services.pipeline.stage1_filter import _search_within_branch

    folio = get_folio()
    out: list[dict] = []
    for item in corpus.get("branch_scoped", []):
        branch_hashes = _resolve_branch_children(folio, item["branch"])
        if branch_hashes is None:
            out.append({"id": item["id"], "text": item["text"], "branch": item["branch"], "error": "branch not resolved"})
            continue
        results = _search_within_branch(folio, item["text"], branch_hashes, threshold=THRESHOLD)
        rows = [
            {
                "iri_hash": h,
                "label": getattr(c, "label", None) or h,
                "score": round(float(s), 4),
            }
            for h, c, s in results
        ]
        rows.sort(key=lambda r: (-r["score"], r["label"], r["iri_hash"]))
        out.append(
            {
                "id": item["id"],
                "text": item["text"],
                "branch": item["branch"],
                "total": len(rows),
                "top": rows[:TOP_N],
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, help="capture name, e.g. baseline / candidate")
    args = parser.parse_args()

    raw = CORPUS_PATH.read_bytes()
    corpus = json.loads(raw)

    capture = {
        "corpus_hash": _corpus_hash(raw),
        "corpus_version": corpus.get("version"),
        "env": _env(),
        "tokenization": run_tokenization(corpus),
        "search_terms": run_search_terms(corpus),
        "score_pairs": run_score_pairs(corpus),
        "search": run_search(corpus),
        "mandatory": run_mandatory(corpus),
        "branch_scoped": run_branch_scoped(corpus),
    }

    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CAPTURES_DIR / f"{args.out}.json"
    out_path.write_text(json.dumps(capture, indent=2, sort_keys=True) + "\n")
    print(f"wrote {out_path}")
    print(f"  corpus_hash      {capture['corpus_hash'][:16]}…")
    print(f"  folio_resolve    {capture['env']['folio_resolve_version'] or 'absent'}")
    print(f"  search rows      {sum(len(r['top']) for r in capture['search'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
