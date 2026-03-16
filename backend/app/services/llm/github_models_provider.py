"""GitHub Models provider — OpenAI-compatible inference with custom model catalog."""

import logging

import httpx

from app.models.llm_models import ModelInfo
from app.services.llm.openai_compat import OpenAICompatProvider

logger = logging.getLogger(__name__)

_CATALOG_URL = "https://models.github.ai/catalog/models"


class GitHubModelsProvider(OpenAICompatProvider):
    """GitHub Models: inference via OpenAI-compat, model listing via catalog API."""

    async def list_models(self) -> list[ModelInfo]:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(_CATALOG_URL, headers=headers)
                resp.raise_for_status()
                data = resp.json()

            # Handle multiple response shapes: list, dict with "models" or "value" key
            if isinstance(data, dict):
                entries = data.get("models") or data.get("value") or []
            elif isinstance(data, list):
                entries = data
            else:
                entries = []

            models: list[ModelInfo] = []
            for entry in entries:
                model_id = entry.get("id", "")
                name = entry.get("friendly_name") or entry.get("displayName") or entry.get("name", model_id)
                limits = entry.get("limits", {})
                ctx = limits.get("max_input_tokens")
                models.append(ModelInfo(id=model_id, name=name, context_window=ctx))

            if models:
                return sorted(models, key=lambda m: m.name)

            logger.debug("GitHub Models catalog returned empty, using fallback")
        except Exception:
            logger.debug("GitHub Models catalog fetch failed, using fallback", exc_info=True)

        # Fall back to parent (OpenAI-compat /models endpoint)
        return await super().list_models()
