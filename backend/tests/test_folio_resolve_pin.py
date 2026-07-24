"""Proves folio-mapper consumes the pinned ``folio-resolve`` library rather than a local fork.

folio-mapper *donated* the deterministic matching core to that library (see
``folio-resolve/docs/migration/SCHEDULE.md`` row 3): the word-order-invariant scorer,
``SEARCH_STOPWORDS``, ``LEGAL_TERM_EXPANSIONS``, ``BRANCH_SIGNAL_WORDS``, the search-term
generator and the judge's verdict-consistency clamps. These tests are the anti-refork guard:

* identity assertions — the module-level tables ARE the library's objects, not copies;
* seam assertions — the two mapper-specific extensions (spaCy vector similarity, spaCy
  similar-word expansion) are still wired into the library's callables;
* golden-score assertions — the committed migration corpus scores exactly as the pre-swap
  baseline did, so a future library bump that moves the scorer fails here first.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import folio_resolve
import pytest
from folio_resolve import judge as folio_resolve_judge
from folio_resolve import scoring as folio_resolve_scoring

from app.services import folio_service
from app.services.pipeline import prompts as pipeline_prompts

MIGRATION = Path(__file__).resolve().parent.parent / "migration"


# --- The tables are the library's objects, not forks -------------------------------------


def test_stopwords_are_the_pinned_library_object():
    assert folio_service.SEARCH_STOPWORDS is folio_resolve_scoring.SEARCH_STOPWORDS
    assert folio_service.SEARCH_STOPWORDS is folio_resolve.SEARCH_STOPWORDS


def test_expansion_tables_are_the_pinned_library_objects():
    assert folio_service.LEGAL_TERM_EXPANSIONS is folio_resolve_scoring.LEGAL_TERM_EXPANSIONS
    assert folio_service.BRANCH_SIGNAL_WORDS is folio_resolve_scoring.BRANCH_SIGNAL_WORDS


def test_tokenizer_functions_are_the_pinned_library_functions():
    assert folio_service._tokenize is folio_resolve_scoring.tokenize
    assert folio_service._content_words is folio_resolve_scoring.content_words


def test_local_scorer_fork_is_gone():
    """The forked scoring internals must not reappear as module-level functions."""
    assert not hasattr(folio_service, "_word_overlap"), "local _word_overlap fork is back"
    # The public entry points survive, but only as bindings onto the library.
    assert folio_service._lib_compute_relevance_score is folio_resolve_scoring.compute_relevance_score
    assert folio_service._lib_generate_search_terms is folio_resolve_scoring.generate_search_terms


# --- Scoring delegates, with mapper's spaCy seam still wired ------------------------------


def test_relevance_score_matches_the_library_directly():
    query = "rules of arbitration"
    content = folio_service._content_words(query)
    assert folio_service._compute_relevance_score(
        content, query, "Arbitration Rules", "Rules governing arbitration.", []
    ) == folio_resolve_scoring.compute_relevance_score(
        content,
        query,
        "Arbitration Rules",
        "Rules governing arbitration.",
        [],
        use_vectors=True,
        word_similarity=folio_service._spacy_word_similarity,
    )


def test_vector_seam_is_passed_into_the_library_scorer():
    """With no character overlap, a positive vector similarity must still lift the score.

    This proves ``use_vectors=True`` plus the spaCy ``word_similarity`` callable reach the
    library's ``word_overlap`` — the library defaults to a no-op similarity, so a bare
    delegation would score 0.0 here.
    """
    query = "zorbleflorp"
    content = folio_service._content_words(query)
    without = folio_service._compute_relevance_score(content, query, "Arbitration", None, [])
    assert without == 0.0

    with patch("app.services.nlp.word_similarity", return_value=0.9):
        with_vectors = folio_service._compute_relevance_score(
            content, query, "Arbitration", None, []
        )
    assert with_vectors > 0.0


def test_search_terms_are_the_library_terms_when_spacy_is_absent():
    from app.services import nlp

    nlp.reset()  # force unavailable
    for term in ("Commercial Litigation", "Small Business Formation (LLC / Corp)"):
        assert folio_service._generate_search_terms(term) == folio_resolve_scoring.generate_search_terms(term)


def test_spacy_expansion_layer_is_appended_on_top_of_the_library_terms():
    """The spaCy layer the library deliberately omits is still folio-mapper's own."""
    from app.services import nlp

    nlp.reset()
    library_terms = folio_resolve_scoring.generate_search_terms("Surgical Error")

    with (
        patch("app.services.nlp.is_available", return_value=True),
        patch("app.services.nlp.similar_words", return_value=[("surgery", 0.8)]),
    ):
        terms = folio_service._generate_search_terms("Surgical Error")

    lowered = [t.lower() for t in terms]
    # library terms are preserved, in order, as the prefix of the result
    assert lowered[: len(library_terms)] == [t.lower() for t in library_terms]
    assert "surgery" in lowered  # standalone similar word
    assert "surgery malpractice" in lowered  # cross-combined with error -> malpractice
    assert len(lowered) == len(set(lowered)), "spaCy layer must not introduce duplicates"


# --- The judge consumes its own donated policy --------------------------------------------


def test_score_calibration_block_is_the_pinned_one():
    assert pipeline_prompts.SCORE_CALIBRATION is folio_resolve_judge.SCORE_CALIBRATION


def test_ranking_and_judge_prompts_embed_the_pinned_calibration():
    from app.models.pipeline_models import (
        PreScanResult,
        PreScanSegment,
        RankedCandidate,
        ScopedCandidate,
    )

    prescan = PreScanResult(
        segments=[PreScanSegment(text="arbitration", branches=["Service"], reasoning="x")],
        raw_text="arbitration",
    )
    scoped = ScopedCandidate(
        iri_hash="R1", label="Arbitration", branch="Service", definition="d", synonyms=[], score=90.0
    )
    ranked = [RankedCandidate(iri_hash="R1", score=90.0, reasoning="r")]

    ranking = pipeline_prompts.build_ranking_prompt("arbitration", prescan, [scoped])
    judging = pipeline_prompts.build_judge_prompt("arbitration", prescan, ranked, {"R1": scoped})

    assert folio_resolve_judge.SCORE_CALIBRATION in ranking[0]["content"]
    assert folio_resolve_judge.SCORE_CALIBRATION in judging[0]["content"]


@pytest.mark.parametrize(
    ("verdict", "raw_score"),
    [
        ("confirmed", 99.0),
        ("confirmed", 10.0),
        ("boosted", 99.0),
        ("penalized", 20.0),
        ("rejected", 80.0),
        ("nonsense-verdict", 42.0),  # falls back to "confirmed"
    ],
)
def test_judge_verdict_clamps_are_the_pinned_policy(verdict: str, raw_score: float):
    from app.models.pipeline_models import RankedCandidate
    from app.services.pipeline.stage3_judge import _parse_judge_json

    ranked_lookup = {"R1": RankedCandidate(iri_hash="R1", score=60.0, reasoning="")}
    raw = json.dumps(
        {"judged": [{"iri_hash": "R1", "adjusted_score": raw_score, "verdict": verdict, "reasoning": "x"}]}
    )
    judged = _parse_judge_json(raw, ranked_lookup)
    assert judged is not None

    effective_verdict = verdict if verdict in folio_resolve_judge.VALID_VERDICTS else "confirmed"
    assert judged[0].adjusted_score == folio_resolve_judge.enforce_verdict(
        60.0, raw_score, effective_verdict
    )


def test_judge_still_guards_the_transport_layer():
    """Behavior the library's parse_judge_json does not cover stays in stage3_judge."""
    from app.models.pipeline_models import RankedCandidate
    from app.services.pipeline.stage3_judge import _parse_judge_json

    ranked_lookup = {"R1": RankedCandidate(iri_hash="R1", score=60.0, reasoning="")}

    # markdown fences are stripped
    fenced = '```json\n{"judged": [{"iri_hash": "R1", "adjusted_score": 62, "verdict": "confirmed"}]}\n```'
    assert _parse_judge_json(fenced, ranked_lookup) is not None

    # a non-numeric adjusted_score is dropped, not raised
    bad = json.dumps({"judged": [{"iri_hash": "R1", "adjusted_score": "high", "verdict": "confirmed"}]})
    assert _parse_judge_json(bad, ranked_lookup) is None

    # hallucinated iri_hash is dropped
    ghost = json.dumps({"judged": [{"iri_hash": "NOPE", "adjusted_score": 90, "verdict": "boosted"}]})
    assert _parse_judge_json(ghost, ranked_lookup) is None


# --- Golden parity with the committed migration baseline ----------------------------------


def _corpus() -> dict:
    return json.loads((MIGRATION / "corpus.json").read_text())


def _baseline() -> dict:
    return json.loads((MIGRATION / "captures" / "baseline.json").read_text())


def test_golden_score_pairs_match_the_pre_swap_baseline():
    """Every committed query/label pair must still score exactly what the fork scored."""
    from app.services import nlp

    nlp.reset()  # the captures were taken with no spaCy vectors available
    expected = {row["id"]: row["score"] for row in _baseline()["score_pairs"]}
    assert expected, "baseline capture has no score pairs"

    for pair in _corpus()["score_pairs"]:
        score = folio_service._compute_relevance_score(
            folio_service._content_words(pair["query"]),
            pair["query"],
            pair["label"],
            pair["definition"],
            list(pair["synonyms"]),
            preferred_label=pair["preferred_label"],
        )
        assert score == expected[pair["id"]], (
            f"{pair['id']}: {pair['query']!r} vs {pair['label']!r} scored {score}, "
            f"baseline was {expected[pair['id']]}"
        )


def test_golden_search_terms_match_the_pre_swap_baseline():
    """Every committed term must still generate exactly the pre-swap search-term SET.

    Compared as a sorted multiset, not a list: term *order* depends on iteration order of a
    ``set`` of content words, which PEP 456 hash randomization varies between processes. That
    nondeterminism is pre-existing (it lives in the donated code, unchanged by the swap), so the
    migration captures pin ``PYTHONHASHSEED=0`` while the test suite — which does not — asserts
    the order-independent part.
    """
    from app.services import nlp

    nlp.reset()
    expected = {row["id"]: row["terms"] for row in _baseline()["search_terms"]}
    for item in _corpus()["terms"]:
        terms = folio_service._generate_search_terms(item["text"])
        assert sorted(terms) == sorted(expected[item["id"]]), item["id"]
        assert terms[0] == expected[item["id"]][0], f"{item['id']}: full phrase must lead"


def test_migration_captures_record_a_consumed_library():
    """The committed candidate capture must be a post-swap one with an empty delta."""
    candidate = json.loads((MIGRATION / "captures" / "candidate.json").read_text())
    delta = json.loads((MIGRATION / "captures" / "delta.json").read_text())

    assert _baseline()["env"]["folio_resolve_consumed"] is False
    assert candidate["env"]["folio_resolve_consumed"] is True
    assert candidate["corpus_hash"] == _baseline()["corpus_hash"]
    assert delta["buckets"] == {}, f"committed migration delta is not empty: {delta['buckets']}"
    assert delta["canary_failures"] == []
