# Third-Party Licenses & Attribution

folio-mapper is licensed **MIT** (see `LICENSE`). It incorporates the open-source components below.

## Openly-licensed data

### FOLIO ontology — CC-BY 4.0

folio-mapper maps free-text terms and spreadsheet columns onto FOLIO concepts. It consumes the FOLIO ontology at runtime via the `folio-python` dependency (which fetches and redistributes `FOLIO.owl`). Because the application surfaces and redistributes FOLIO concepts to end users, it must preserve the CC-BY 4.0 attribution below.

FOLIO (Federated Open Legal Information Ontology) is maintained by the **ALEA Institute**, originating from the **SALI Alliance**, licensed **CC-BY 4.0**.

- Source: https://github.com/alea-institute/FOLIO · License: https://creativecommons.org/licenses/by/4.0/

## Notable dependencies

### Backend (Python)

| Component | License | Notes |
|-----------|---------|-------|
| fastapi | MIT | API framework |
| uvicorn | BSD-3-Clause | ASGI server |
| folio-python | MIT | FOLIO ontology client (redistributes FOLIO CC-BY data — see above) |
| **folio-resolve** | MIT | Shared FOLIO source-text→concept matching engine (word-order-invariant scorer, stopwords, legal-term expansions, search-term generation, judge verdict rules). Damien's own library, resolved from PyPI (`folio-resolve>=0.1.0` in `backend/pyproject.toml`). folio-mapper **donated** this code and now consumes it back instead of owning the fork — migration `SCHEDULE.md` row 3; see `backend/migration/`. |
| alea-llm-client | MIT | Client-agnostic LLM integration |
| openai | Apache-2.0 | OpenAI API client |
| anthropic | MIT | Anthropic (Claude) API client |
| rapidfuzz | MIT | Fuzzy string matching |
| marisa-trie | MIT / BSD-2-Clause (dual) | Prefix-search trie |
| openpyxl | MIT | XLSX read/write |
| httpx | BSD-3-Clause | HTTP client |
| python-multipart | Apache-2.0 | Multipart form parsing |
| slowapi | MIT | Rate limiting |
| sentence-transformers *(optional `embedding`)* | Apache-2.0 | Embedding models |
| faiss-cpu *(optional `embedding`)* | MIT | Similarity search |
| spacy *(optional `nlp`)* | MIT | NLP pipeline |

### Frontend (TypeScript / npm)

| Component | License | Notes |
|-----------|---------|-------|
| react, react-dom | MIT | UI framework |
| zustand | MIT | State management |
| vite | MIT | Build tooling |
| tailwindcss | MIT | Styling |
| electron *(desktop app)* | MIT | Desktop shell |
| electron-log *(desktop app)* | MIT | Desktop logging |

No copyleft (GPL/AGPL/LGPL/EPL) dependencies are present.
