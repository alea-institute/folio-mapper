# Plan: Collapse Stage 3 judge JSON parsing onto folio-resolve

**Status:** Implemented
**Created:** 2026-07-30
**Type:** Migration (stage 2)

## Background

Stage 0 (`64e3657`) established the golden baseline harness for retiring mapper-owned matching
code. Stage 1 (`96aacf7`) moved the deterministic matching core and judge verdict policy onto
the pinned `folio-resolve` library, but deliberately retained Stage 3's local JSON transport
parser because the published library did not yet cover its defensive behavior.

`folio-resolve` 0.3.0 now provides a non-raising `parse_judge_json` that handles markdown fences,
malformed payload shapes, hallucinated IRIs, invalid scores, score clamping, and verdict
enforcement. This stage removes the remaining parser fork while preserving mapper's model and
fallback contracts.

## Scope

- Raise the backend dependency floor to `folio-resolve>=0.3.0`.
- Delete Stage 3's local markdown-fence stripper and validation loop.
- Keep a thin `_parse_judge_json` adapter that:
  - passes `{iri_hash: ranked_score}` to the library;
  - maps library `iri` rows to mapper `iri_hash` models;
  - sources `original_score` from mapper's ranked lookup; and
  - converts an empty library result to `None` so existing fallback judging still runs.
- Extend the anti-refork tests to prove the local fence stripper stays absent and the adapter
  delegates to the library callable.

## Out of Scope

- Search-term ordering determinism remains deferred to the separate alea-intake migration
  decision (`q2-term-order`).
- Other pipeline stages, demo/exemplar work, and unrelated dependency upgrades are unchanged.
- No remote push or branch work is part of this operation.

## Verification

Run from `backend/` against the local editable `folio-resolve` checkout:

```bash
uv pip install -e ../../folio-resolve
FOLIO_MAPPER_NO_AUTH=true FOLIO_MAPPER_NO_RATE_LIMIT=true .venv/bin/pytest
```

Acceptance requires the full backend suite to pass, including `tests/test_pipeline.py` and the
extended `tests/test_folio_resolve_pin.py`, with only the migration files staged for the local
stage-2 commit.
