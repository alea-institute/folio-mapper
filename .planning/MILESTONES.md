# Milestones

## v1.0 Exemplars, Demo & New-Tab Sessions (Shipped: 2026-05-23)

**Phases completed:** 3 phases, 8 plans, 17 tasks

**Key accomplishments:**

- **Phase 1 — Revamp Exemplars:** 10 practice-area-specific exemplars (PI, family, IP, employment, M&A, etc.) whose every leaf maps to a precise FOLIO label, yielding a 100% hit rate from the "Try an Exemplar" carousel.
- **Phase 2 — Demo Mode:** A Demo toggle flips the exemplar cards from lean precision payloads to pre-cached pipeline output (mappings, candidates, judge annotations) — "watch curation happen" with zero runtime LLM cost. Offline curation script + static manifest + stale-preset banner.
- **Phase 3 — New (Fresh Session in New Tab):** folio-enrich-style always-visible "New" button opens a fresh tab; session persistence reworked to per-tab namespaced localStorage; on-demand session picker with auto-resume (zero-click), LRU cap (~5), legacy migration, and removal of the old in-place reset / recovery-modal gate / beforeunload warning.
- **Quick task (260522-q0p):** Per-session **Rename** in the picker — inline edit-in-place, custom name persisted in the registry and preserved across auto-saves.
- **Deploy fix:** Repaired the Railway Docker build (broken since 2026-04-06) — Node 22 + pinned pnpm, plus the missing `apps/desktop/package.json` version-manifest copy. DEV and PROD both shipped.

**Closed during milestone close:** 2 April debug sessions (`area-of-law-sparse-results`, `mandatory-branch-slider`) re-tested and resolved — discovery deficit mitigated by the post-April embedding/spaCy/bridging search work (Area of Law candidates for "Securities Litigation": 1 → 4). Residual `computeScoreCutoff` global-threshold edge case noted as a future enhancement.

---
