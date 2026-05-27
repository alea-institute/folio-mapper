"""Pydantic models for LLM provider integration."""

from enum import Enum

from pydantic import BaseModel


class LLMProviderType(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    MISTRAL = "mistral"
    COHERE = "cohere"
    META_LLAMA = "meta_llama"
    OLLAMA = "ollama"
    LMSTUDIO = "lmstudio"
    CUSTOM = "custom"
    GROQ = "groq"
    XAI = "xai"
    GITHUB_MODELS = "github_models"
    LLAMAFILE = "llamafile"


class ConnectionTestRequest(BaseModel):
    provider: LLMProviderType
    base_url: str | None = None
    model: str | None = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    model: str | None = None
    # Machine-readable failure category so the client can react (e.g. probe other
    # models on a model-specific failure). None on success.
    reason: str | None = None


class ModelListRequest(BaseModel):
    provider: LLMProviderType
    base_url: str | None = None


class ModelProbeRequest(BaseModel):
    provider: LLMProviderType
    base_url: str | None = None
    models: list[str]


class ModelProbeResult(BaseModel):
    model: str
    available: bool
    reason: str | None = None


class ModelProbeResponse(BaseModel):
    results: list[ModelProbeResult]


class ModelInfo(BaseModel):
    id: str
    name: str
    context_window: int | None = None


class LLMConfig(BaseModel):
    provider: LLMProviderType
    base_url: str | None = None
    model: str | None = None
