"""Provider factory and metadata registry."""

import os

from app.models.llm_models import LLMProviderType, ModelInfo

# Standard environment variable names for API keys per provider
PROVIDER_ENV_VAR: dict[LLMProviderType, str] = {
    LLMProviderType.OPENAI: "OPENAI_API_KEY",
    LLMProviderType.ANTHROPIC: "ANTHROPIC_API_KEY",
    LLMProviderType.GOOGLE: "GOOGLE_API_KEY",
    LLMProviderType.MISTRAL: "MISTRAL_API_KEY",
    LLMProviderType.COHERE: "COHERE_API_KEY",
    LLMProviderType.META_LLAMA: "META_LLAMA_API_KEY",
    LLMProviderType.GROQ: "GROQ_API_KEY",
    LLMProviderType.XAI: "XAI_API_KEY",
    LLMProviderType.GITHUB_MODELS: "GITHUB_MODELS_API_KEY",
}
from app.services.llm.anthropic_provider import AnthropicProvider
from app.services.llm.base import BaseLLMProvider
from app.services.llm.cohere_provider import CohereProvider
from app.services.llm.github_models_provider import GitHubModelsProvider
from app.services.llm.google_provider import GoogleProvider
from app.services.llm.openai_compat import OpenAICompatProvider
from app.services.llm.url_validator import validate_base_url

# Default base URLs per provider
DEFAULT_BASE_URLS: dict[LLMProviderType, str] = {
    LLMProviderType.OPENAI: "https://api.openai.com/v1",
    LLMProviderType.ANTHROPIC: "https://api.anthropic.com",
    LLMProviderType.GOOGLE: "https://generativelanguage.googleapis.com/v1beta",
    LLMProviderType.MISTRAL: "https://api.mistral.ai/v1",
    LLMProviderType.COHERE: "https://api.cohere.com/v2",
    LLMProviderType.META_LLAMA: "https://api.llama.com/v1",
    LLMProviderType.OLLAMA: "http://localhost:11434/v1",
    LLMProviderType.LMSTUDIO: "http://localhost:1234/v1",
    LLMProviderType.CUSTOM: "http://localhost:8080/v1",
    LLMProviderType.GROQ: "https://api.groq.com/openai/v1",
    LLMProviderType.XAI: "https://api.x.ai/v1",
    LLMProviderType.GITHUB_MODELS: "https://models.github.ai/inference",
    LLMProviderType.LLAMAFILE: "http://127.0.0.1:8080/v1",
}

# Default model per provider (used when none selected)
DEFAULT_MODELS: dict[LLMProviderType, str] = {
    LLMProviderType.OPENAI: "gpt-5.2",
    LLMProviderType.ANTHROPIC: "claude-sonnet-4-6",
    LLMProviderType.GOOGLE: "gemini-2.5-flash",
    LLMProviderType.MISTRAL: "mistral-large-latest",
    LLMProviderType.COHERE: "command-a-03-2025",
    LLMProviderType.META_LLAMA: "llama-4-scout",
    LLMProviderType.OLLAMA: "",
    LLMProviderType.LMSTUDIO: "",
    LLMProviderType.CUSTOM: "",
    LLMProviderType.GROQ: "llama-3.3-70b-versatile",
    LLMProviderType.XAI: "grok-4-0709",
    LLMProviderType.GITHUB_MODELS: "openai/gpt-5.2",
    LLMProviderType.LLAMAFILE: "",
}

# Display names for the UI
PROVIDER_DISPLAY_NAMES: dict[LLMProviderType, str] = {
    LLMProviderType.OPENAI: "OpenAI",
    LLMProviderType.ANTHROPIC: "Anthropic",
    LLMProviderType.GOOGLE: "Google Gemini",
    LLMProviderType.MISTRAL: "Mistral",
    LLMProviderType.COHERE: "Cohere",
    LLMProviderType.META_LLAMA: "Meta Llama",
    LLMProviderType.OLLAMA: "Ollama",
    LLMProviderType.LMSTUDIO: "LM Studio",
    LLMProviderType.CUSTOM: "Custom",
    LLMProviderType.GROQ: "Groq",
    LLMProviderType.XAI: "xAI",
    LLMProviderType.GITHUB_MODELS: "GitHub Models",
    LLMProviderType.LLAMAFILE: "Llamafile",
}

# Whether the provider requires an API key
REQUIRES_API_KEY: dict[LLMProviderType, bool] = {
    LLMProviderType.OPENAI: True,
    LLMProviderType.ANTHROPIC: True,
    LLMProviderType.GOOGLE: True,
    LLMProviderType.MISTRAL: True,
    LLMProviderType.COHERE: True,
    LLMProviderType.META_LLAMA: True,
    LLMProviderType.OLLAMA: False,
    LLMProviderType.LMSTUDIO: False,
    LLMProviderType.CUSTOM: False,
    LLMProviderType.GROQ: True,
    LLMProviderType.XAI: True,
    LLMProviderType.GITHUB_MODELS: True,
    LLMProviderType.LLAMAFILE: False,
}

# Providers that use OpenAI-compatible API
_OPENAI_COMPAT_PROVIDERS = {
    LLMProviderType.OPENAI,
    LLMProviderType.MISTRAL,
    LLMProviderType.META_LLAMA,
    LLMProviderType.OLLAMA,
    LLMProviderType.LMSTUDIO,
    LLMProviderType.CUSTOM,
    LLMProviderType.GROQ,
    LLMProviderType.XAI,
    LLMProviderType.LLAMAFILE,
}


# Well-known models per provider (shown without API key; refresh fetches live).
KNOWN_MODELS: dict[LLMProviderType, list["ModelInfo"]] = {
    LLMProviderType.OPENAI: [
        ModelInfo(id="gpt-4o-mini", name="GPT-4o Mini", context_window=128000),
        ModelInfo(id="gpt-4o", name="GPT-4o", context_window=128000),
        ModelInfo(id="gpt-4.1-nano", name="GPT-4.1 Nano", context_window=1047576),
        ModelInfo(id="gpt-4.1-mini", name="GPT-4.1 Mini", context_window=1047576),
        ModelInfo(id="gpt-4.1", name="GPT-4.1", context_window=1047576),
        ModelInfo(id="o3-mini", name="o3-mini", context_window=200000),
        ModelInfo(id="o3", name="o3", context_window=200000),
        ModelInfo(id="o4-mini", name="o4-mini", context_window=200000),
        ModelInfo(id="gpt-5-mini", name="GPT-5 Mini", context_window=1047576),
        ModelInfo(id="gpt-5", name="GPT-5", context_window=1047576),
        ModelInfo(id="gpt-5.2", name="GPT-5.2", context_window=1047576),
        ModelInfo(id="gpt-5.2-pro", name="GPT-5.2 Pro", context_window=1047576),
    ],
    LLMProviderType.ANTHROPIC: [
        ModelInfo(id="claude-haiku-4-5-20251001", name="Claude Haiku 4.5", context_window=200000),
        ModelInfo(id="claude-sonnet-4-5-20250929", name="Claude Sonnet 4.5", context_window=200000),
        ModelInfo(id="claude-sonnet-4-6", name="Claude Sonnet 4.6", context_window=200000),
        ModelInfo(id="claude-opus-4-6", name="Claude Opus 4.6", context_window=200000),
    ],
    LLMProviderType.GOOGLE: [
        ModelInfo(id="gemini-2.5-flash-lite", name="Gemini 2.5 Flash-Lite", context_window=1048576),
        ModelInfo(id="gemini-2.5-flash", name="Gemini 2.5 Flash", context_window=1048576),
        ModelInfo(id="gemini-2.5-pro", name="Gemini 2.5 Pro", context_window=1048576),
        ModelInfo(id="gemini-3-flash-preview", name="Gemini 3 Flash Preview", context_window=200000),
        ModelInfo(id="gemini-3-pro-preview", name="Gemini 3 Pro Preview", context_window=1048576),
        ModelInfo(id="gemini-3.1-pro-preview", name="Gemini 3.1 Pro Preview", context_window=1048576),
    ],
    LLMProviderType.MISTRAL: [
        ModelInfo(id="mistral-small-latest", name="Mistral Small", context_window=128000),
        ModelInfo(id="mistral-medium-latest", name="Mistral Medium", context_window=128000),
        ModelInfo(id="mistral-large-latest", name="Mistral Large", context_window=128000),
        ModelInfo(id="codestral-latest", name="Codestral", context_window=32000),
        ModelInfo(id="devstral-latest", name="Devstral", context_window=256000),
    ],
    LLMProviderType.COHERE: [
        ModelInfo(id="command-r", name="Command R", context_window=128000),
        ModelInfo(id="command-r-plus", name="Command R+", context_window=128000),
        ModelInfo(id="command-a-03-2025", name="Command A", context_window=256000),
        ModelInfo(id="command-a-vision-07-2025", name="Command A Vision", context_window=256000),
        ModelInfo(id="command-a-reasoning-08-2025", name="Command A Reasoning", context_window=256000),
    ],
    LLMProviderType.META_LLAMA: [
        ModelInfo(id="llama-3.3-70b-instruct", name="Llama 3.3 70B", context_window=128000),
        ModelInfo(id="llama-4-scout", name="Llama 4 Scout", context_window=512000),
        ModelInfo(id="llama-4-maverick", name="Llama 4 Maverick", context_window=256000),
    ],
    LLMProviderType.GROQ: [
        ModelInfo(id="gemma2-9b-it", name="Gemma 2 9B", context_window=8192),
        ModelInfo(id="mixtral-8x7b-32768", name="Mixtral 8x7B", context_window=32768),
        ModelInfo(id="llama-3.1-8b-instant", name="Llama 3.1 8B Instant", context_window=128000),
        ModelInfo(id="llama-3.3-70b-versatile", name="Llama 3.3 70B Versatile", context_window=128000),
        ModelInfo(id="llama-guard-3-8b", name="Llama Guard 3 8B", context_window=8192),
        ModelInfo(id="qwen/qwen3-32b", name="Qwen3 32B", context_window=128000),
        ModelInfo(id="meta-llama/llama-4-scout-17b-16e-instruct", name="Llama 4 Scout 17B", context_window=512000),
        ModelInfo(id="openai/gpt-oss-120b", name="GPT-OSS 120B", context_window=128000),
    ],
    LLMProviderType.XAI: [
        ModelInfo(id="grok-3", name="Grok 3", context_window=131072),
        ModelInfo(id="grok-3-mini", name="Grok 3 Mini", context_window=131072),
        ModelInfo(id="grok-4-0709", name="Grok 4", context_window=256000),
        ModelInfo(id="grok-4-1-fast-reasoning", name="Grok 4.1 Fast", context_window=2000000),
    ],
    LLMProviderType.GITHUB_MODELS: [
        ModelInfo(id="openai/gpt-4o-mini", name="OpenAI GPT-4o Mini", context_window=128000),
        ModelInfo(id="openai/gpt-4o", name="OpenAI GPT-4o", context_window=128000),
        ModelInfo(id="meta/llama-3.3-70b-instruct", name="Meta Llama 3.3 70B", context_window=128000),
        ModelInfo(id="openai/gpt-4.1", name="OpenAI GPT-4.1", context_window=1047576),
        ModelInfo(id="meta/llama-4-scout", name="Meta Llama 4 Scout", context_window=512000),
        ModelInfo(id="mistral-ai/mistral-large-latest", name="Mistral Large", context_window=128000),
        ModelInfo(id="openai/gpt-5.2", name="OpenAI GPT-5.2", context_window=1047576),
    ],
    # Local providers: suggested models for Ollama, no known for others
    LLMProviderType.OLLAMA: [
        ModelInfo(id="qwen3:4b", name="Qwen3 4B", context_window=32000),
        ModelInfo(id="qwen3:8b", name="Qwen3 8B", context_window=32000),
        ModelInfo(id="llama3.3:8b", name="Llama 3.3 8B", context_window=128000),
        ModelInfo(id="mistral:7b", name="Mistral 7B", context_window=32000),
        ModelInfo(id="phi4:14b", name="Phi-4 14B", context_window=16000),
        ModelInfo(id="qwen3:14b", name="Qwen3 14B", context_window=32000),
        ModelInfo(id="qwen3:32b", name="Qwen3 32B", context_window=32000),
    ],
    LLMProviderType.LMSTUDIO: [],
    LLMProviderType.CUSTOM: [],
    LLMProviderType.LLAMAFILE: [],
}


def get_provider(
    provider_type: LLMProviderType,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> BaseLLMProvider:
    """Create a provider instance from the given configuration."""
    if base_url is None:
        _env_urls = {
            LLMProviderType.OLLAMA: os.environ.get("FOLIO_MAPPER_OLLAMA_BASE_URL", "http://localhost:11434") + "/v1",
            LLMProviderType.LMSTUDIO: os.environ.get("FOLIO_MAPPER_LMSTUDIO_BASE_URL", "http://localhost:1234") + "/v1",
            LLMProviderType.CUSTOM: os.environ.get("FOLIO_MAPPER_CUSTOM_BASE_URL", "http://localhost:8080") + "/v1",
            LLMProviderType.LLAMAFILE: os.environ.get("FOLIO_MAPPER_LLAMAFILE_BASE_URL", "http://localhost:8080") + "/v1",
        }
        resolved_url = _env_urls.get(provider_type, DEFAULT_BASE_URLS[provider_type])
    else:
        resolved_url = base_url

    # SSRF protection: validate URL before creating provider
    validate_base_url(resolved_url, provider_type)

    # Env var fallback: if no key provided via header, check env
    if not api_key and provider_type in PROVIDER_ENV_VAR:
        api_key = os.environ.get(PROVIDER_ENV_VAR[provider_type]) or None

    if provider_type == LLMProviderType.GITHUB_MODELS:
        return GitHubModelsProvider(api_key=api_key, base_url=resolved_url, model=model)
    elif provider_type in _OPENAI_COMPAT_PROVIDERS:
        return OpenAICompatProvider(api_key=api_key, base_url=resolved_url, model=model)
    elif provider_type == LLMProviderType.ANTHROPIC:
        return AnthropicProvider(api_key=api_key, base_url=resolved_url, model=model)
    elif provider_type == LLMProviderType.GOOGLE:
        return GoogleProvider(api_key=api_key, base_url=resolved_url, model=model)
    elif provider_type == LLMProviderType.COHERE:
        return CohereProvider(api_key=api_key, base_url=resolved_url, model=model)
    else:
        raise ValueError(f"Unknown provider type: {provider_type}")


def sort_and_enrich_models(
    live_models: list[ModelInfo],
    provider_type: LLMProviderType,
) -> list[ModelInfo]:
    """Sort live models (known first by curated order, unknowns alphabetically) and enrich metadata."""
    known = KNOWN_MODELS.get(provider_type, [])
    known_by_id: dict[str, tuple[int, ModelInfo]] = {
        m.id: (i, m) for i, m in enumerate(known)
    }

    # Deduplicate by model id (keep first occurrence)
    seen: set[str] = set()
    unique: list[ModelInfo] = []
    for m in live_models:
        if m.id not in seen:
            seen.add(m.id)
            unique.append(m)

    def sort_key(m: ModelInfo) -> tuple[int, str]:
        if m.id in known_by_id:
            return (known_by_id[m.id][0], "")
        return (len(known) + 1, m.id.lower())

    unique.sort(key=sort_key)

    # Enrich: backfill display name and context_window from known models
    enriched: list[ModelInfo] = []
    for m in unique:
        if m.id in known_by_id:
            _, known_m = known_by_id[m.id]
            name = m.name if m.name != m.id else known_m.name
            ctx = m.context_window if m.context_window is not None else known_m.context_window
            enriched.append(ModelInfo(id=m.id, name=name, context_window=ctx))
        else:
            enriched.append(m)

    return enriched
