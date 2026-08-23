from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.models.pipeline_models import RankedCandidate, ScopedCandidate
from scripts import synthetic_runner


def _iri(value: str) -> str:
    return f"https://folio.openlegalstandard.org/{value}"


def _candidate(iri: str, score: float) -> ScopedCandidate:
    return ScopedCandidate(
        iri_hash=iri,
        label=iri,
        branch="Service",
        score=score,
        source_branches=[],
    )


def test_folio_search_dependency_is_available_to_the_synthetic_runner():
    from alea_llm_client import get_llm_kwargs

    assert callable(get_llm_kwargs)


def test_comparison_iris_are_canonical_and_idempotent():
    full = "https://folio.openlegalstandard.org/R123"
    assert synthetic_runner._canonical_iri("R123") == full
    assert synthetic_runner._canonical_iri(full) == full
    with pytest.raises(ValueError, match="outside the FOLIO namespace"):
        synthetic_runner._canonical_iri("https://example.com/R123")


def test_contract_uses_precomputed_segments_and_real_stage_seams(tmp_path: Path):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text(json.dumps({"item_id": "i-1", "text": "whole", "segments": ["alpha", "beta"]}) + "\n")

    folio = Mock()
    index = Mock()
    stage1_rows = [[_candidate("z", 50), _candidate("a", 70)], [_candidate("z", 80)]]

    with (
        patch.object(synthetic_runner, "get_folio", return_value=folio),
        patch.object(synthetic_runner, "build_embedding_index") as build_index,
        patch.object(synthetic_runner, "get_embedding_index", return_value=index),
        patch.object(synthetic_runner, "run_stage1", side_effect=stage1_rows) as stage1,
        patch.object(
            synthetic_runner,
            "_embedding_rerank",
            side_effect=[
                [RankedCandidate(iri_hash="a", score=72), RankedCandidate(iri_hash="z", score=60)],
                [RankedCandidate(iri_hash="z", score=81)],
            ],
        ) as rerank,
        patch("app.services.llm.registry.get_provider") as llm_registry,
    ):
        assert synthetic_runner.main(["--items", str(source), "--out", str(output)]) == 0

    build_index.assert_called_once_with()
    assert [call.args[1].segments[0].text for call in stage1.call_args_list] == ["alpha", "beta"]
    assert [call.args[0] for call in rerank.call_args_list] == ["alpha", "beta"]
    llm_registry.assert_not_called()

    lines = [json.loads(line) for line in output.read_text().splitlines()]
    assert lines[0]["kind"] == "synthetic-stack-run"
    assert lines[0]["stack"] == "folio-mapper"
    assert lines[0]["lane"] == "deterministic"
    assert lines[0]["config"]["embedding_rerank"] == "available"
    assert lines[1] == {
        "item_id": "i-1",
        "iris": [_iri("a"), _iri("z")],
        "stages": {
            "stage1_filter": [_iri("z"), _iri("a")],
            "embedding_rerank": [_iri("z"), _iri("a")],
            "committed": [_iri("z"), _iri("a")],
        },
    }


def test_output_is_byte_deterministic_with_embedding_rerank(tmp_path: Path):
    source = tmp_path / "items.jsonl"
    first = tmp_path / "first.jsonl"
    second = tmp_path / "second.jsonl"
    source.write_text('{"item_id":"i","text":"x","segments":["x"]}\n')

    with (
        patch.object(synthetic_runner, "get_folio", return_value=Mock()),
        patch.object(synthetic_runner, "build_embedding_index"),
        patch.object(synthetic_runner, "get_embedding_index", return_value=Mock()),
        patch.object(
            synthetic_runner,
            "run_stage1",
            return_value=[_candidate("b", 50), _candidate("a", 50)],
        ),
        patch.object(
            synthetic_runner,
            "_embedding_rerank",
            return_value=[
                RankedCandidate(iri_hash="a", score=60, reasoning="keyword=50 emb=75"),
                RankedCandidate(iri_hash="b", score=50, reasoning="keyword=50 emb=50"),
            ],
        ),
    ):
        assert synthetic_runner.main(["--items", str(source), "--out", str(first)]) == 0
        assert synthetic_runner.main(["--items", str(source), "--out", str(second)]) == 0

    assert first.read_bytes() == second.read_bytes()
    header = json.loads(first.read_text().splitlines()[0])
    assert header["config"]["embedding_rerank"] == "available"


def test_embedding_unavailable_after_build_fails_closed_without_output(
    tmp_path: Path, capsys: pytest.CaptureFixture[str],
):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text('{"item_id":"i","text":"x","segments":["x"]}\n')

    with (
        patch.object(synthetic_runner, "get_folio", return_value=Mock()) as get_folio,
        patch.object(synthetic_runner, "build_embedding_index") as build_index,
        patch.object(synthetic_runner, "get_embedding_index", return_value=None),
        patch.object(synthetic_runner, "run_stage1") as stage1,
    ):
        assert synthetic_runner.main(["--items", str(source), "--out", str(output)]) != 0

    build_index.assert_called_once_with()
    get_folio.assert_not_called()
    stage1.assert_not_called()
    assert not output.exists()
    assert "embedding index unavailable after synchronous initialization" in capsys.readouterr().err


def test_local_score_rerank_fallback_fails_closed_without_output(
    tmp_path: Path, capsys: pytest.CaptureFixture[str],
):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text('{"item_id":"i","text":"x","segments":["x"]}\n')

    with (
        patch.object(synthetic_runner, "get_folio", return_value=Mock()),
        patch.object(synthetic_runner, "build_embedding_index"),
        patch.object(synthetic_runner, "get_embedding_index", return_value=Mock()),
        patch.object(
            synthetic_runner,
            "run_stage1",
            return_value=[_candidate("b", 50), _candidate("a", 40)],
        ),
        patch.object(
            synthetic_runner,
            "_embedding_rerank",
            return_value=[
                RankedCandidate(iri_hash="b", score=50, reasoning="local score"),
                RankedCandidate(iri_hash="a", score=40, reasoning="local score"),
            ],
        ),
    ):
        assert synthetic_runner.main(["--items", str(source), "--out", str(output)]) != 0

    assert not output.exists()
    assert "semantic embedding rerank fell back to local scores" in capsys.readouterr().err


def test_missing_segments_returns_nonzero_without_writing_output(tmp_path: Path, capsys):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text('{"item_id":"bad","text":"x"}\n')

    assert synthetic_runner.main(["--items", str(source), "--out", str(output)]) != 0
    assert not output.exists()
    assert "segments" in capsys.readouterr().err


def test_llm_on_requires_provider_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text('{"item_id":"i","text":"x","segments":["x"]}\n')
    for name in synthetic_runner.LLM_PROVIDER_ENV_VARS:
        monkeypatch.delenv(name, raising=False)

    assert synthetic_runner.main(["--items", str(source), "--out", str(output), "--llm-on"]) != 0
    assert not output.exists()
    assert "--llm-on requires a provider API key" in capsys.readouterr().err


def test_llm_on_runs_full_pipeline_and_emits_llm_stages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
):
    source = tmp_path / "items.jsonl"
    output = tmp_path / "out.jsonl"
    source.write_text('{"item_id":"i","text":"whole text","segments":["precomputed"]}\n')
    for name in synthetic_runner.LLM_PROVIDER_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "secret-not-for-output")

    response = SimpleNamespace(
        mapping=SimpleNamespace(items=[SimpleNamespace(branch_groups=[
            SimpleNamespace(candidates=[SimpleNamespace(iri_hash="service-iri")]),
        ])]),
        pipeline_metadata=[SimpleNamespace(
            prescan=SimpleNamespace(segments=[SimpleNamespace(text="whole text")]),
            stage1_candidate_count=4,
            stage1b_expanded_count=2,
            stage2_candidate_count=3,
            stage3_judged_count=1,
            stage3_boosted=1,
            stage3_penalized=0,
            stage3_rejected=2,
        )],
    )

    with patch.object(
        synthetic_runner, "run_pipeline", new_callable=AsyncMock, return_value=response,
    ) as pipeline:
        assert synthetic_runner.main([
            "--items", str(source), "--out", str(output), "--llm-on",
        ]) == 0

    item = pipeline.call_args.args[0][0]
    config = pipeline.call_args.args[1]
    assert item.text == "whole text"
    assert config.provider.value == "openai"
    assert config.model == "gpt-5.5"
    assert pipeline.call_args.kwargs == {}

    lines = [json.loads(line) for line in output.read_text().splitlines()]
    assert lines[0]["lane"] == "llm-on"
    assert lines[0]["config"]["llm_provider"] == "openai"
    assert lines[0]["config"]["llm_model"] == "gpt-5.5"
    assert lines[0]["config"]["segmentation"] == "pipeline"
    assert "secret-not-for-output" not in output.read_text()
    assert lines[1] == {
        "item_id": "i",
        "iris": [_iri("service-iri")],
        "stages": {
            "stage0_prescan": ["whole text"],
            "stage1_filter": 4,
            "stage1b_expand": 2,
            "embedding_rerank": 3,
            "stage3_judge": {
                "judged": 1,
                "boosted": 1,
                "penalized": 0,
                "rejected": 2,
            },
            "committed": [_iri("service-iri")],
        },
    }
