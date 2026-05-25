"""Local embedding provider using sentence-transformers."""

from __future__ import annotations

import logging

import numpy as np

from app.services.embedding.base import BaseEmbeddingProvider

logger = logging.getLogger(__name__)

# MiniLM (384-dim) is the default: it matches the proven folio-enrich config on
# the shared PROD box and keeps the one-time index build well within memory.
# mpnet (768-dim) is higher quality but its cold build over ~18K concepts spiked
# to ~6GB and OOM-killed the service on the shared box — do not default to it.
_DEFAULT_MODEL = "all-MiniLM-L6-v2"


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """Offline embedding provider using sentence-transformers.

    Default model: all-MiniLM-L6-v2 (384-dim, low memory — matches folio-enrich).
    Alternative: all-mpnet-base-v2 (768-dim, higher quality, ~6GB build — needs
    a larger instance; do not use on the shared PROD box).
    """

    def __init__(self, model: str | None = None):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers is required for local embeddings. "
                "Install with: pip install sentence-transformers"
            )

        self._model_name = model or _DEFAULT_MODEL
        logger.info("Loading sentence-transformers model: %s", self._model_name)
        self._model = SentenceTransformer(self._model_name)
        self._dim = self._model.get_sentence_embedding_dimension()
        logger.info("Model loaded: %s (dim=%d)", self._model_name, self._dim)

    def embed(self, text: str) -> np.ndarray:
        vec = self._model.encode(text, normalize_embeddings=True)
        return np.asarray(vec, dtype=np.float32)

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        # Modest batch size caps peak memory during the one-time index build on
        # the shared PROD box (a 256 batch was a major contributor to the OOM).
        vecs = self._model.encode(texts, normalize_embeddings=True, batch_size=64)
        return np.asarray(vecs, dtype=np.float32)

    def dimension(self) -> int:
        return self._dim

    @property
    def model_name(self) -> str:
        return self._model_name
