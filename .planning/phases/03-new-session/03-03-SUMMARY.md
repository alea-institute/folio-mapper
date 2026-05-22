---
phase: 03-new-session
plan: "03"
subsystem: session-ui
tags: [session, ui, new-tab, session-picker, header, appshell]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["SessionPickerModal", "always-visible-New-button", "on-demand-picker"]
  affects: ["apps/web/src/App.tsx", "packages/ui/src/components/layout/Header.tsx", "packages/ui/src/components/layout/AppShell.tsx"]
tech_stack:
  added: []
  patterns: ["local-state-for-picker-list", "on-demand-modal-vs-startup-gate", "always-visible-action-button"]
key_files:
  created:
    - packages/ui/src/components/session/SessionPickerModal.tsx
  modified:
    - packages/ui/src/components/layout/Header.tsx
    - packages/ui/src/components/layout/AppShell.tsx
    - packages/ui/src/index.ts
    - apps/web/src/App.tsx
  deleted:
    - packages/ui/src/components/session/NewProjectModal.tsx
decisions:
  - "SessionRecord interface defined locally in SessionPickerModal (UI package cannot depend on web app store)"
  - "SessionPickerModal rendered in both mapping-screen return and input/confirming return so picker works on all screens"
  - "pickerSessions seeded via useEffect on showSessionPicker change, refreshed inline after deleteFromRegistry call"
metrics:
  duration: "8m"
  completed: "2026-05-22T22:35:09Z"
  tasks: 3
  files: 5
---

# Phase 03 Plan 03: UI Surface — Session Picker, New Button, and NewProjectModal Removal Summary

Always-visible "New" (open-fresh-tab) button plus on-demand session picker on all three screens, NewProjectModal deleted and all forced recovery gates removed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SessionPickerModal.tsx (D-07b) | b3b17b6 | packages/ui/src/components/session/SessionPickerModal.tsx |
| 2 | Make "New" always-visible + add picker trigger | 85fde96 | Header.tsx, AppShell.tsx, index.ts |
| 3 | Wire App.tsx + delete NewProjectModal.tsx | 07243a4 | App.tsx, NewProjectModal.tsx (deleted) |

## What Was Built

**Task 1 — SessionPickerModal:** Multi-session list picker with per-row Resume (primary blue), Delete (secondary), plus global Start New and Close actions. Sessions sorted descending by `updatedAt` (D-14). Current tab row highlighted with blue badge. Empty-state with Start New. `role="dialog" aria-modal="true"` shell matching SessionRecoveryModal pattern. `SessionRecord` interface defined locally (UI package cannot depend on web app store).

**Task 2 — Header/AppShell/barrel:**
- `Header.tsx`: removed `onNewProject`, `hasActiveSession`, `newProjectPopover` props; added `onNewTab` and `onOpenSessionPicker`. "New" button now always rendered when `onNewTab` is provided (no `hasActiveSession &&` guard — D-10, Pitfall 6). Clock icon "Open recent session" button added.
- `AppShell.tsx`: added `onNewTab` and `onOpenSessionPicker` to props and passes both through to `Header`.
- `index.ts`: exports `SessionPickerModal`; `NewProjectModal` export removed (D-02).

**Task 3 — App.tsx wiring + deletion:**
- `SessionPickerModal` import replaces `NewProjectModal`. `tabIdentity`, `readRegistry`, `deleteFromRegistry` imported.
- `pickerSessions` local state (seeded via `useEffect` when `session.showSessionPicker` becomes true).
- Mapping-screen Header: `onNewTab={session.handleNewTab}` + `onOpenSessionPicker={session.handleOpenSessionPicker}`.
- AppShell (input/confirming): same two props added — "New" visible on all three screens (D-10).
- Forced `SessionRecoveryModal` startup gate removed; replaced by on-demand `SessionPickerModal` gated by `session.showSessionPicker` (rendered in both screen branches).
- `onDelete` calls `deleteFromRegistry(tabId)` then `setPickerSessions(readRegistry())` so the deleted row disappears immediately without a close+reopen.
- `packages/ui/src/components/session/NewProjectModal.tsx` deleted. Zero repo-wide references remain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] SessionRecord type defined locally in SessionPickerModal**
- **Found during:** Task 1
- **Issue:** The plan specified `sessions: SessionRecord[]` but `SessionRecord` lives in `apps/web/src/store/session-registry.ts` — the `@folio-mapper/ui` package cannot import from the web app.
- **Fix:** Defined a compatible `SessionRecord` interface directly in `SessionPickerModal.tsx` (mirrors the shape exactly).
- **Files modified:** packages/ui/src/components/session/SessionPickerModal.tsx
- **Commit:** b3b17b6

**2. [Rule 2 - Missing] SessionPickerModal added to mapping-screen return block**
- **Found during:** Task 3
- **Issue:** Plan only mentioned adding the picker in the input/confirming AppShell return, but the mapping screen renders its own layout (not through AppShell). Without adding it there too, clicking the clock button on the mapping screen would have no effect.
- **Fix:** `SessionPickerModal` rendered in both the `if (screen === 'mapping')` return and the `<AppShell>` return, both gated by `session.showSessionPicker`.
- **Files modified:** apps/web/src/App.tsx
- **Commit:** 07243a4

## Known Stubs

None — all picker data comes from `readRegistry()` (real localStorage registry), `tabIdentity.tabId` is the real tab identity, and `session.handlePickerResume` performs real store rehydration.

## Threat Surface Scan

No new security-relevant surface introduced:
- `window.open(pathname + '?new=1', '_blank')` is guarded in `useSession.handleNewTab` (pathname only, no user-controlled URL).
- `deleteFromRegistry(tabId)` targets a single tabId from a rendered row — no bulk delete.
- Picker metadata (dates, counts, filenames) is non-sensitive client-side data (T-03-12: accepted).

## Verification Results

- `pnpm --filter @folio-mapper/ui test --run`: 28/28 tests passed
- `pnpm --filter @folio-mapper/web test --run`: 76/76 tests passed
- `pnpm --filter @folio-mapper/web build`: succeeded (316 modules transformed)
- Repo-wide `NewProjectModal` grep: 0 references
- `hasActiveSession` guard in Header: 0 references
- `SessionPickerModal` rendered gated by `session.showSessionPicker`: confirmed

## Self-Check

| Item | Status |
|------|--------|
| packages/ui/src/components/session/SessionPickerModal.tsx | FOUND |
| packages/ui/src/components/layout/Header.tsx (onNewTab, no hasActiveSession) | FOUND |
| packages/ui/src/components/layout/AppShell.tsx (onNewTab pass-through) | FOUND |
| packages/ui/src/index.ts (SessionPickerModal exported, NewProjectModal removed) | FOUND |
| apps/web/src/App.tsx (SessionPickerModal wired, forced gate removed) | FOUND |
| packages/ui/src/components/session/NewProjectModal.tsx | DELETED |
| Commit b3b17b6 (Task 1) | EXISTS |
| Commit 85fde96 (Task 2) | EXISTS |
| Commit 07243a4 (Task 3) | EXISTS |

## Self-Check: PASSED
