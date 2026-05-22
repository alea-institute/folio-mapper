---
phase: 260522-q0p
plan: 01
subsystem: session-management
tags: [session, rename, localStorage, ui, accessibility]
dependency_graph:
  requires: []
  provides: [session-rename-feature]
  affects: [session-registry, session-picker-modal, app-wiring]
tech_stack:
  added: []
  patterns: [inline-edit-in-place, registry-pure-functions, onWrite-preservation]
key_files:
  created: []
  modified:
    - apps/web/src/store/session-registry.ts
    - apps/web/src/store/session-registry.test.ts
    - apps/web/src/store/mapping-store.ts
    - packages/ui/src/components/session/SessionPickerModal.tsx
    - apps/web/src/App.tsx
decisions:
  - renameSession does NOT update updatedAt to avoid bumping session rank in the picker list
  - Escape inside the rename input calls stopPropagation before cancelRename to prevent modal close
  - onWrite-preservation implemented by carrying existing?.customName in the record constructor (not in upsertRegistry) to keep registry concerns local to session-registry.ts
  - Only one row editable at a time (single editingTabId state); clicking Rename on a new row replaces any open editor
metrics:
  duration: ~6 minutes
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Quick Task 260522-q0p: Add Rename Button to Session Picker Summary

**One-liner:** Inline edit-in-place rename for session picker rows, backed by a new `customName` field + `renameSession()` pure function in the session registry, with onWrite preservation so debounced store writes never overwrite user-supplied names.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add customName + renameSession() + onWrite preservation | 3ba2738 | session-registry.ts, session-registry.test.ts, mapping-store.ts |
| 2 | Add inline rename edit-in-place to SessionPickerModal | ff10784 | packages/ui/src/components/session/SessionPickerModal.tsx |
| 3 | Wire onRename through App.tsx (both render sites) | bca08dd | apps/web/src/App.tsx |

## What Was Built

### session-registry.ts
- Added optional `customName?: string | null` to `SessionRecord` interface (back-compat: old records without the field are treated as `null`)
- Added exported pure function `renameSession(tabId, name)`: reads registry, finds record by tabId (no-op if absent), sets trimmed name or `null` for empty/whitespace input, writes back with QuotaExceededError guard — does NOT mutate `updatedAt`, does NOT re-sort

### mapping-store.ts (onWrite path)
- Added `customName: existing?.customName ?? null` to the record object built inside the `onWrite` callback
- This is the core pitfall guard: every debounced store write now carries the existing custom name forward instead of clobbering it with the auto-derived `sourceFile`

### SessionPickerModal.tsx (packages/ui)
- Added `customName?: string | null` to the locally-mirrored `SessionRecord` interface (no web-app import)
- Added `onRename: (tabId: string, name: string) => void` prop
- Per-row display label computed as `customName ?? sourceFile ?? 'Untitled'` (used in heading + all aria-labels)
- Edit state: `editingTabId` + `draft` (only one row editable at a time)
- Rename button in each row's action bar; clicking enters edit mode seeded with current label
- Inline `<input>` when editing: accessible `aria-label`, auto-focused via ref + useEffect, Enter saves, Escape cancels with `e.stopPropagation()` to prevent dialog close
- Save and Cancel inline buttons alongside the input
- Rename button in the action bar toggles to Cancel when that row is in edit mode
- Matches existing Tailwind style: `rounded-md border border-gray-300`, `bg-blue-600` primary

### App.tsx
- Imported `renameSession` alongside existing registry imports
- Added `onRename={(tabId, name) => { renameSession(tabId, name); setPickerSessions(readRegistry()); }}` to BOTH `SessionPickerModal` render sites (~line 799 and ~line 1004)

## Test Results

```
pnpm --filter @folio-mapper/web test          → 80 passed (10 test files)
pnpm --filter './packages/*' test             → 50 passed (6 test files: core + ui)
pnpm build                                     → built in 5.98s (clean)
```

Session-registry tests: 13 passed (7 original + 6 new renameSession tests covering: trimmed name, clear on empty, clear on whitespace, no-op on unknown tabId, updatedAt unchanged, onWrite-preservation).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The `customName` value is rendered as React text children (auto-escaped) — T-q0p-02 mitigation confirmed present by design.

## Self-Check: PASSED

All modified files found on disk. All 3 task commits verified in git log (3ba2738, ff10784, bca08dd).
