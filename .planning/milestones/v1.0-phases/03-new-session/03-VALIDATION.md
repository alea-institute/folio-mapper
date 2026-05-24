---
phase: 3
slug: new-session
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom environment) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @folio-mapper/web test --run` |
| **Full suite command** | `pnpm --filter @folio-mapper/web test --run && pnpm --filter @folio-mapper/ui test --run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @folio-mapper/web test --run`
- **After every plan wave:** Run `pnpm --filter @folio-mapper/web test --run && pnpm --filter @folio-mapper/ui test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

Phase 3 has no REQUIREMENTS.md; the locked decisions (D-01…D-14) in `03-CONTEXT.md` are the
requirement IDs. The planner will assign task IDs; this map binds each behavior to its decision
and automated command. `File Exists` = whether the test file exists today.

| Decision | Behavior | Wave | Test Type | Automated Command | File Exists | Status |
|----------|----------|------|-----------|-------------------|-------------|--------|
| D-01 | `handleNewTab` calls `window.open` with `?new=1` and `_blank` | 2 | unit | `pnpm --filter @folio-mapper/web test --run -- useSession` | ❌ W0 | ⬜ pending |
| D-05 | `?new=1` in URL → new tabId in sessionStorage → param stripped via `history.replaceState` | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- tab-identity` | ❌ W0 | ⬜ pending |
| D-06 | Legacy single-session keys migrated/adopted to namespaced keys on first boot (no data loss) | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- session-registry` | ❌ W0 | ⬜ pending |
| D-07 | No tab identity + sessions in registry → auto-resume most-recently-modified, zero clicks | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- session-registry` | ❌ W0 | ⬜ pending |
| D-08 | Existing `sessionStorage` tabId → stores hydrate from that tab's namespaced keys (refresh) | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- tab-identity` | ❌ W0 | ⬜ pending |
| D-09 | 6th session write evicts the LRU (least-recently-modified) session's data from localStorage | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- session-registry` | ❌ W0 | ⬜ pending |
| D-12 | `beforeunload` handler no longer registered | 2 | unit | `pnpm --filter @folio-mapper/web test --run -- useSession` | ❌ W0 | ⬜ pending |
| D-14 | `updatedAt` in registry reflects time of write, drives auto-resume + LRU + picker sort | 1 | unit | `pnpm --filter @folio-mapper/web test --run -- session-registry` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/store/tab-identity.test.ts` — stubs for D-01, D-05, D-08 boot paths
- [ ] `apps/web/src/store/session-registry.test.ts` — stubs for D-06, D-07, D-09, D-14 registry behavior
- [ ] `apps/web/src/hooks/useSession.test.ts` — stubs for D-12 (beforeunload removed) + boot resolver

*vitest + jsdom already configured (`apps/web/vitest.config.ts`); no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| New tab actually opens in a separate browser tab | D-01 | `window.open` is mocked in jsdom; real cross-tab behavior needs a browser | Click "New" → confirm a new tab opens, current tab unchanged, no prompt |
| Per-tab isolation across two real open tabs | D-04 | True multi-tab localStorage isolation isn't observable in a single jsdom context | Open two tabs, edit each, confirm neither clobbers the other's saved work |
| Auto-resume after full browser close/reboot | D-07/D-13 | Requires real browser shutdown lifecycle | Map work, fully quit browser, reopen page → lands directly in most-recent session, fully mapped |
| Session picker visual/UX (Resume/Start New/Delete) | D-07b | Visual layout + interaction better verified by eye | Open picker from header → confirm list, metadata, and three actions per entry |

---

## Validation Sign-Off

- [ ] All decisions have an `<automated>` verify or a Wave 0 test dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING test files (tab-identity, session-registry, useSession)
- [ ] No watch-mode flags in commands (all use `--run`)
- [ ] Feedback latency < ~20s
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 stubs land

**Approval:** pending
