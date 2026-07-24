# folio-mapper → folio-resolve migration harness

Golden-baseline discipline for retiring folio-mapper's in-repo copy of the deterministic
matching core (`app/services/folio_service.py`) in favor of the pinned
[`folio-resolve`](https://github.com/damienriehl/folio-resolve) library. See
`folio-resolve/docs/migration/SCHEDULE.md` row 3.

folio-mapper is the **donor** of most of that library: the word-order-invariant scorer, the
stopword set, `LEGAL_TERM_EXPANSIONS`, `BRANCH_SIGNAL_WORDS`, the search-term generator and the
judge's verdict-enforcement rules were all lifted from this repo. The migration therefore has a
sharper bar than folio-enrich's did: **the expected delta is empty**. Anything else means the
library drifted from its donor.

## What this is

- **`corpus.json`** — synthetic corpus (NO customer taxonomies). Exercises exact labels,
  word-order invariance, legal-term expansions, the specificity penalty, sub-phrase recall,
  all-stopword inputs, place/jurisdiction rows, homonyms, compound headings, abbreviations and
  a nonsense term.
- **`harness.py`** — runs the corpus through folio-mapper's deterministic seams ($0 LLM spend,
  no embedding index) and writes a capture. Six seams:
  1. `tokenization` → `_tokenize` / `_content_words`
  2. `search_terms` → `_generate_search_terms`
  3. `score_pairs` → `_compute_relevance_score` on fixed query/label pairs
  4. `search` → `search_candidates` (Phase 1 → 4, bridging on)
  5. `mandatory` → `search_candidates(..., mandatory_branches=[...])` (Phase 2.7)
  6. `branch_scoped` → `pipeline.stage1_filter._search_within_branch`
- **`compare.py`** — classified-delta comparator (`term_delta` / `score_delta` / `set_delta` /
  `rank_delta`) plus the migration canaries. Writes `DELTA-REPORT.md` + `captures/delta.json`
  and exits non-zero on a canary failure.
- **`captures/baseline.json`** — the committed pre-swap golden baseline
  (`env.folio_resolve_consumed = false`).
- **`captures/candidate.json`** — the committed post-swap capture
  (`env.folio_resolve_consumed = true`).

## Run

```bash
cd backend
# Stage 0 — baseline (pre-swap). Committed as captures/baseline.json.
.venv/bin/python migration/harness.py --out baseline

# Stage 1 — after wiring folio-resolve, recapture and diff:
.venv/bin/python migration/harness.py --out candidate
.venv/bin/python migration/compare.py --baseline baseline --candidate candidate
```

The corpus content hash is pinned into every capture; `compare.py` refuses to diff captures
taken from different corpora.

## Canaries

1. **PARITY** — zero deltas across all six seams. A pure internals swap must not move a single
   score. (`--expect-changes` exists for a *documented* deliberate change; it was not used.)
2. **PLACES-PRESERVED** — folio-mapper maps arbitrary taxonomies, so places and jurisdictions
   are legitimate mapping targets. The library's `PlaceNameGate` — correct for folio-enrich's
   prose tagging, where "Slovenia → 99" is a false positive — must **not** be applied here.
   Rows in the `place` category must keep their top-1 concept.
3. **STOPWORD-FALLBACK** — all-stopword inputs (`"The Law"`) must keep hitting the
   `_tokenize()` fallback rather than collapsing to zero candidates.

## Environment notes

- `nlp_available: false` in the captures — spaCy is installed in the backend venv but no
  `en_core_web_{lg,md}` model is present, so the vector-similarity path is inert. That path is
  injected into the library as a callable (`word_similarity`), so it is wired identically either
  way; a machine with a model installed will produce a different (but internally consistent)
  capture. Recapture the baseline before diffing on such a machine.
- `embedding_index_active: false` — the FAISS index is optional and absent here, keeping the
  capture deterministic.
