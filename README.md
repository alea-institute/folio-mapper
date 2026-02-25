# FOLIO Mapper

**Map any taxonomy to the [FOLIO ontology](https://folio.openlegalstandard.org/) — an open legal standard with ~18,300 concepts across 24 branches.**

FOLIO Mapper combines fuzzy text matching, semantic embedding search, and an optional multi-stage LLM pipeline to produce high-quality taxonomy mappings. Available as a web app or a standalone desktop application (Windows & macOS), with export to 8 formats.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Desktop Application](#desktop-application)
- [Embedding Semantic Search](#embedding-semantic-search)
- [LLM Provider Support](#llm-provider-support)
- [LLM-Enhanced Pipeline](#llm-enhanced-pipeline)
- [Export Formats](#export-formats)
- [Session Persistence](#session-persistence)
- [ALEA Suggestion Queue](#alea-suggestion-queue)
- [Security](#security)
- [Testing](#testing)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [FOLIO Ontology](#folio-ontology)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Data Input
- **File upload** — Excel (`.xlsx`), CSV, TSV, TXT, Markdown with drag-and-drop
- **Text entry** — Paste or type items directly, one per line
- **Hierarchy detection** — Automatically detects parent-child relationships from blank-cell indentation in CSVs
- **Branch pre-filtering** — Select which FOLIO branches to search before mapping begins

### Mapping & Search
- **Fuzzy matching** — Label + synonym matching against all ~18,300 FOLIO classes using rapidfuzz
- **Semantic search** — FAISS-powered embedding similarity search with 3 provider options
- **Branch-grouped display** — Candidates organized by FOLIO branch with color coding
- **Confidence scores** — Color-coded badges (green 88-99, yellow 60-87, orange <60)
- **Top N filter** — Slider to show top 1-50 candidates (or all)
- **Branch states** — Mark branches as mandatory (always shown) or excluded (hidden)
- **Detail panel** — Full definition, DAG visualization, hierarchy path, children, siblings, translations
- **Search & filter** — Search across all candidates by label, definition, or synonym
- **Selection tree** — Check candidates to accept mappings, with structural grouping
- **Per-item notes** — Add free-text notes to any item
- **Status tracking** — Items marked as completed, pending, skipped, or needs attention with filter

### LLM-Enhanced Pipeline (Optional)
- **4-stage pipeline** — Pre-scan, branch-scoped search, embedding re-rank, judge validation
- **9 LLM providers** — OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Meta Llama, Ollama, LM Studio, Custom
- **Graceful fallback** — Each stage degrades independently if the LLM is unavailable

### Session Persistence
- **Auto-save** to localStorage with 5-second debounce
- **Recovery modal** on startup — resume, start fresh, or download backup
- **Manual save/load** via Ctrl+S and file picker
- **New Project** flow preserving LLM settings

### Export (8 Formats)
- CSV, Excel, JSON, RDF/Turtle, JSON-LD, Markdown, HTML, PDF
- Column toggles, IRI format options, 5-row preview
- Translation columns in 10 languages

### ALEA Suggestion Queue
- Flag items with no good FOLIO match for ontology improvement
- Edit and submit suggestions as GitHub issues

### Desktop Application
- **Windows** (`.exe` installer) and **macOS** (`.dmg`, x64 + ARM)
- Self-contained — bundles the Python backend via PyInstaller
- Optional local LLM support via Llamafile integration

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **pnpm** (`npm install -g pnpm`)

### Install

```bash
# Clone the repo
git clone https://github.com/damienriehl/folio-mapper.git
cd folio-mapper

# Install frontend dependencies
pnpm install

# Set up the Python backend
cd backend
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows
pip install -e ".[dev]"

# Optional: Enable embedding semantic search
pip install -e ".[embedding]"
```

### Run

```bash
# Start both frontend + backend concurrently
pnpm dev

# Or run them separately:
pnpm dev:api     # Backend  → http://localhost:58000
pnpm dev:web     # Frontend → http://localhost:58173
```

The frontend proxies `/api/*` requests to the backend automatically via Vite.

### Test

```bash
pnpm test         # Frontend tests (vitest — core + UI + web)
pnpm test:api     # Backend tests (pytest — 380+ test cases)
```

---

## Architecture

```
folio-mapper/
├── packages/
│   ├── core/                    # Shared types + API clients (no React deps)
│   │   └── src/
│   │       ├── input/           # Parse types & API client
│   │       ├── folio/           # FOLIO types, branch colors, display order
│   │       ├── mapping/         # Mapping types, score computation
│   │       ├── llm/             # LLM provider types & API client
│   │       ├── pipeline/        # Pipeline types & API client
│   │       ├── session/         # Session file schema (v1.2)
│   │       ├── export/          # Export types & API client
│   │       ├── embedding/       # Embedding status & API client
│   │       ├── suggestion/      # ALEA suggestion types & GitHub issue generation
│   │       └── auth.ts          # Auth header utilities
│   └── ui/                      # Pure React components (~49 components)
│       └── src/components/
│           ├── input/           # TextInput, FileDropZone, InputScreen
│           ├── confirmation/    # Flat & hierarchical confirmation views
│           ├── layout/          # AppShell, Header, pane layouts
│           ├── mapping/         # MappingScreen + 17 sub-components
│           │   └── graph/       # ConceptDAG SVG visualization
│           ├── settings/        # LLMSettings modal, ProviderCard
│           ├── export/          # ExportModal, format picker, preview
│           └── session/         # RecoveryModal, NewProjectModal
├── apps/
│   ├── web/                     # Main React application
│   │   └── src/
│   │       ├── App.tsx          # Screen flow: input → confirming → mapping
│   │       ├── store/           # Zustand stores (input, mapping, LLM)
│   │       └── hooks/           # 11 custom hooks (useMapping, useSession, useExport, etc.)
│   └── desktop/                 # Electron desktop app
│       └── src/
│           ├── main.ts          # Electron main process + IPC
│           ├── preload.ts       # Sandboxed IPC bridge
│           ├── backend-manager.ts   # PyInstaller backend lifecycle
│           ├── llamafile-manager.ts # Local LLM integration
│           └── port-finder.ts       # Dynamic port allocation
└── backend/                     # FastAPI backend
    ├── app/
    │   ├── main.py              # App factory, CORS, middleware, lifespan
    │   ├── models/              # Pydantic request/response models
    │   ├── routers/             # 9 API routers
    │   ├── middleware/          # Local auth middleware
    │   └── services/
    │       ├── folio_service.py       # FOLIO singleton, search, hierarchy (~1050 lines)
    │       ├── file_parser.py         # Excel/CSV/TSV/TXT/Markdown parsing
    │       ├── export_service.py      # 8 export format generators
    │       ├── hierarchy_detector.py  # Indentation-based hierarchy detection
    │       ├── llm/                   # LLM provider implementations
    │       │   ├── base.py            # Abstract base provider
    │       │   ├── registry.py        # Provider lookup
    │       │   ├── openai_compat.py   # Shared OpenAI-compatible logic
    │       │   ├── anthropic_provider.py
    │       │   ├── google_provider.py
    │       │   ├── cohere_provider.py
    │       │   └── url_validator.py   # SSRF protection
    │       ├── pipeline/              # LLM-enhanced mapping stages
    │       │   ├── orchestrator.py    # Stage 0 → 1 → 2 → 3
    │       │   ├── stage0_prescan.py  # LLM branch tagging
    │       │   ├── stage1_filter.py   # Fuzzy + embedding search
    │       │   ├── stage2_rank.py     # Embedding re-ranking
    │       │   ├── stage3_judge.py    # LLM score adjustment
    │       │   └── prompts.py         # 12 system/user prompt templates
    │       └── embedding/             # Semantic embedding search
    │           ├── service.py         # Singleton embedding service
    │           ├── folio_index.py     # FAISS index builder + cache
    │           ├── local_provider.py  # sentence-transformers
    │           ├── ollama_provider.py
    │           └── openai_provider.py
    └── tests/                   # 380+ pytest test cases across 23 files
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Zustand 5, Tailwind CSS 3, Vite 6, TypeScript 5.7 |
| **Backend** | FastAPI, Python 3.11+, uvicorn, Pydantic v2 |
| **Search** | [folio-python](https://github.com/alea-institute/folio-python), rapidfuzz, marisa-trie |
| **Embeddings** | sentence-transformers, FAISS, numpy |
| **LLM SDKs** | OpenAI SDK, Anthropic SDK, httpx |
| **Desktop** | Electron 33, electron-builder, PyInstaller |
| **Testing** | vitest (frontend), pytest + pytest-asyncio (backend) |
| **CI/CD** | GitHub Actions (Windows + macOS builds on tag push) |

---

## API Reference

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `GET` | `/api/health` | Health check | — |
| `POST` | `/api/parse/file` | Parse uploaded file (xlsx/csv/tsv/txt/md) | 60/min |
| `POST` | `/api/parse/text` | Parse plain text input | 60/min |
| `POST` | `/api/mapping/candidates` | Search FOLIO candidates for a term | 60/min |
| `GET` | `/api/mapping/status` | FOLIO ontology loading status | — |
| `GET` | `/api/mapping/branches` | List all FOLIO branches | — |
| `GET` | `/api/mapping/concept/{iri_hash}` | Lookup concept by IRI hash | — |
| `GET` | `/api/mapping/concept/{iri_hash}/detail` | Full concept detail (children, siblings, translations) | — |
| `POST` | `/api/mapping/mandatory-fallback` | LLM-assisted search for mandatory branches | 20/min |
| `POST` | `/api/llm/test-connection` | Test LLM provider connectivity | 30/min |
| `POST` | `/api/llm/models` | Discover available models for a provider | 30/min |
| `POST` | `/api/pipeline/map` | Run full LLM-enhanced mapping pipeline | 20/min |
| `GET` | `/api/embedding/status` | Embedding index status | 60/min |
| `POST` | `/api/embedding/warmup` | Build/warm FAISS embedding index | 5/min |
| `POST` | `/api/export/generate` | Generate export file in chosen format | 60/min |
| `POST` | `/api/export/preview` | Preview first 5 export rows | 60/min |
| `POST` | `/api/export/translations` | Fetch translations for mapped concepts | 60/min |
| `POST` | `/api/github/submit-issue` | Submit ALEA suggestion as GitHub issue | 10/min |
| `POST` | `/api/synthetic/generate` | Generate demo taxonomy data via LLM | 10/min |
| `GET` | `/api/pricing/estimate` | Estimate LLM pipeline cost | — |

---

## Desktop Application

FOLIO Mapper is available as a self-contained desktop app for **Windows** and **macOS**.

### Download

Pre-built installers are published as [GitHub Releases](https://github.com/damienriehl/folio-mapper/releases) on each version tag:

| Platform | File |
|----------|------|
| Windows (x64) | `folio-mapper-windows.exe` |
| macOS (Intel) | `folio-mapper-mac-x64.dmg` |
| macOS (Apple Silicon) | `folio-mapper-mac-arm64.dmg` |

### How It Works

The desktop app bundles:
1. **Vite-built web frontend** — served from the app's resources
2. **PyInstaller-bundled Python backend** — runs as a local subprocess
3. **Electron shell** — manages the window, IPC, and lifecycle

On launch, Electron starts the backend on a dynamic port (default 58000), waits for the health check to pass, then loads the frontend. A local auth token secures communication between the frontend and backend.

### Llamafile Integration

The desktop app supports [Llamafile](https://github.com/Mozilla-Ocho/llamafile) for running LLMs entirely locally — no API keys or internet required.

### Building from Source

```bash
# Build the web frontend
pnpm build

# Build the desktop app (requires Python .venv with PyInstaller)
pnpm build:desktop

# Or use the build script directly
bash scripts/build-desktop.sh
```

### CI/CD

GitHub Actions automatically builds Windows and macOS installers when a version tag is pushed:

```bash
git tag v0.7.8
git push origin v0.7.8
# → Triggers build → Artifacts uploaded to GitHub Releases
```

---

## Embedding Semantic Search

FOLIO Mapper can build a FAISS vector index over all ~18,300 FOLIO concepts, enabling semantic similarity search that complements keyword-based fuzzy matching.

### How It Works

1. Each concept is embedded as `"label: definition"` text
2. Vectors are normalized and stored in a `FAISS IndexFlatIP` index (cosine similarity)
3. The index is cached at `~/.folio/cache/embeddings/{model}_{owl_hash}.pkl`
4. On search, embedding candidates bypass per-branch keyword limits so semantic matches aren't crowded out

### Providers

| Provider | Model | Requires |
|----------|-------|----------|
| **Local** (default) | `all-MiniLM-L6-v2` | `sentence-transformers`, `faiss-cpu` |
| **Ollama** | Configurable | Running Ollama instance |
| **OpenAI** | `text-embedding-3-small` | OpenAI API key |

### Setup

```bash
# Install embedding dependencies
cd backend
pip install -e ".[embedding]"

# The index builds automatically on first search (~30s for 18K concepts)
```

### Status Indicator

The header displays an embedding status dot:
- **Green** — Index ready, semantic search active
- **Blue (pulsing)** — Index building
- **Gray** — Embeddings unavailable (dependencies not installed)

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Model name |
| `EMBEDDING_BASE_URL` | — | Custom endpoint for Ollama/OpenAI |
| `EMBEDDING_API_KEY` | — | API key for OpenAI embeddings |
| `EMBEDDING_DISABLED` | — | Set to disable embeddings entirely |

---

## LLM Provider Support

FOLIO Mapper supports 9 LLM providers for enhanced mapping. Configure via the Settings modal in the UI.

| Provider | Protocol | Default Model | API Key Required |
|----------|----------|---------------|:----------------:|
| **OpenAI** | OpenAI SDK | `gpt-4o` | Yes |
| **Anthropic** | Anthropic SDK | `claude-3-5-sonnet-20241022` | Yes |
| **Google Gemini** | HTTP (httpx) | `gemini-2.0-flash` | Yes |
| **Mistral** | OpenAI-compatible | `mistral-large-latest` | Yes |
| **Cohere** | HTTP (httpx) | `command-r-plus` | Yes |
| **Meta Llama** | OpenAI-compatible | Configurable | Yes |
| **Ollama** | OpenAI-compatible | Configurable | No |
| **LM Studio** | OpenAI-compatible | Configurable | No |
| **Custom** | OpenAI-compatible | User-defined | Optional |

**Security**: API keys are passed via HTTP headers (not request bodies) and are never persisted on the backend.

**Auto-test on save**: When you click Save & Close, the app tests the API key before closing. Invalid keys show a red error banner and keep the modal open.

---

## LLM-Enhanced Pipeline

When an LLM provider is configured, the mapping pipeline adds intelligent processing on top of local search:

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 0 — Pre-scan                                         │
│  LLM segments text and tags relevant FOLIO branches         │
│  (temp=0.1, max_tokens=1024)                                │
├─────────────────────────────────────────────────────────────┤
│  Stage 1 — Branch-scoped Search                             │
│  Fuzzy keyword matching + FAISS embedding candidates        │
│  within the branches identified by Stage 0                  │
├─────────────────────────────────────────────────────────────┤
│  Stage 2 — Embedding Re-rank                                │
│  Blends keyword (60%) + embedding (40%) similarity scores   │
│  to produce a refined candidate ranking                     │
├─────────────────────────────────────────────────────────────┤
│  Stage 3 — Judge Validation                                 │
│  LLM reviews each candidate, adjusts scores:               │
│  confirmed / boosted / penalized / rejected                 │
└─────────────────────────────────────────────────────────────┘
```

Each stage degrades gracefully if the LLM is unavailable — the pipeline always produces results, with or without LLM assistance.

---

## Export Formats

Export your mappings via Ctrl+E or the Export button. All formats support column toggles and a 5-row preview.

| Format | Extension | Notes |
|--------|-----------|-------|
| **CSV** | `.csv` | Universal spreadsheet compatibility |
| **Excel** | `.xlsx` | Formatted with openpyxl |
| **JSON** | `.json` | Structured mapping data |
| **RDF/Turtle** | `.ttl` | Semantic web / linked data |
| **JSON-LD** | `.jsonld` | Linked data in JSON format |
| **Markdown** | `.md` | Human-readable tables |
| **HTML** | `.html` | Interactive, styled report |
| **PDF** | `.pdf` | Print-ready document |

### Export Options

- **Columns**: Item text, IRI (hash/full/short format), score, branch, definition, notes
- **Translations**: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Chinese
- **Scope**: All items, mapped only, or filtered subset

---

## Session Persistence

FOLIO Mapper automatically preserves your work:

- **Auto-save** — Debounced 5-second writes to localStorage (mapping state, input state, LLM settings stored separately)
- **Recovery modal** — On startup, choose to resume your previous session, start fresh, or download a backup
- **Manual save** — Ctrl+S saves a `.json` session file to disk
- **Manual load** — Import a previously saved session file
- **New Project** — Prompts to save or discard current work; LLM settings are always preserved
- **beforeunload** — Browser warns before closing with unsaved changes

Session files use schema version 1.2 and include the full mapping state, input items, and import history.

---

## ALEA Suggestion Queue

When no good FOLIO match exists for an item, you can flag it for ontology improvement:

1. Press **F** to flag an item (or click the flag icon)
2. Edit the suggested label, definition, synonyms, parent class, and branch
3. Preview the GitHub issue that will be created
4. Submit directly via GitHub PAT authentication, or copy to clipboard

Suggestions are submitted as issues to the FOLIO ontology repository to help improve coverage.

---

## Security

FOLIO Mapper implements defense-in-depth security:

- **SSRF protection** — URL validation with allowlists for external requests
- **API key security** — Keys transmitted via HTTP headers, never in request bodies, never persisted server-side
- **Local auth token** — Desktop app generates a token at `~/.folio/cache/local_token` to secure frontend-backend IPC
- **CORS hardening** — Strict origin allowlist (configurable via `CORS_ORIGINS`)
- **Security headers** — Standard protective headers on all responses
- **Rate limiting** — Per-endpoint limits via slowapi (see [API Reference](#api-reference))
- **Prompt injection mitigation** — Structured prompts with input sanitization for LLM calls
- **File upload limits** — Size and type restrictions on uploaded files
- **HTML escaping** — All user content escaped in exports and responses
- **Error sanitization** — Internal details stripped from error responses
- **Dependency pinning** — All Python and Node dependencies pinned to specific versions

---

## Testing

### Backend (pytest)

380+ test cases across 23 test files covering:

- FOLIO service (search, hierarchy, branches)
- File parsing (Excel, CSV, TSV, TXT)
- LLM providers (all 9, mocked)
- Pipeline stages (0-3, orchestrator, prompts)
- Embedding (FAISS index, providers, cache, service)
- Export (all 8 formats)
- Security (auth, rate limiting, SSRF)
- API routers (all endpoints)

```bash
cd backend
source .venv/bin/activate
pytest                              # All tests
pytest tests/test_folio_service.py  # Specific file
pytest -x                           # Stop on first failure
```

### Frontend (vitest)

```bash
pnpm test                    # All frontend tests
pnpm --filter core test      # Core package only
pnpm --filter ui test        # UI components only
```

### Test Environment Variables

| Variable | Purpose |
|----------|---------|
| `FOLIO_MAPPER_NO_AUTH` | Skip local auth token checks |
| `FOLIO_MAPPER_NO_RATE_LIMIT` | Disable rate limiting |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `EMBEDDING_PROVIDER` | `local` | Embedding provider: `local`, `ollama`, `openai` |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Embedding model name |
| `EMBEDDING_BASE_URL` | — | Custom embedding endpoint URL |
| `EMBEDDING_API_KEY` | — | API key for OpenAI embeddings |
| `EMBEDDING_DISABLED` | — | Set to any value to disable embeddings |
| `FOLIO_MAPPER_WEB_DIR` | — | Path to serve SPA from (desktop mode) |
| `FOLIO_MAPPER_NO_AUTH` | — | Disable local auth (testing only) |
| `FOLIO_MAPPER_NO_RATE_LIMIT` | — | Disable rate limiting (testing only) |

### Ports

| Service | Default Port |
|---------|-------------|
| Backend (FastAPI) | 58000 |
| Frontend (Vite dev) | 58173 |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between items |
| `Enter` | Next item |
| `Shift+A` | Accept all default selections |
| `G` | Go to item by number |
| `F` | Flag item for ALEA suggestion |
| `?` | Show keyboard shortcuts overlay |
| `Ctrl+S` | Save session to file |
| `Ctrl+E` | Open export modal |
| `Escape` | Close modals |

---

## FOLIO Ontology

[FOLIO](https://folio.openlegalstandard.org/) (Federated Open Legal Information Ontology) is an open legal standard maintained by the [ALEA Institute](https://aleainstitute.ai/). It provides a comprehensive taxonomy for legal information with:

- **~18,300 classes** across **24 branches**
- Branches include: Actor/Player, Area of Law, Asset Type, Communication Modality, Currency, Data Format, Document/Artifact, Engagement Terms, Event, Forums/Venues, Governmental Body, Industry, Language, Legal Authorities, Legal Entity, Location, Matter Narrative, Matter Narrative Format, Objectives, Service, Standards Compatibility, Status, System Identifiers, and more
- Each class has: IRI, label, definition, alternative labels, parent/child relationships, examples, and translations

The ontology is loaded via [folio-python](https://github.com/alea-institute/folio-python) and cached locally at `~/.folio/cache` (5-15 seconds on first load, instant thereafter).

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Run the test suites (`pnpm test && pnpm test:api`)
5. Commit and push
6. Open a pull request

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Damien Riehl
