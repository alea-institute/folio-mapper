---
phase: 03-new-session
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/web/src/App.tsx
  - apps/web/src/hooks/useSession.ts
  - apps/web/src/hooks/useSession.test.ts
  - apps/web/src/store/input-store.ts
  - apps/web/src/store/mapping-store.ts
  - apps/web/src/store/session-registry.ts
  - apps/web/src/store/session-registry.test.ts
  - apps/web/src/store/session-storage.ts
  - apps/web/src/store/tab-identity.ts
  - apps/web/src/store/tab-identity.test.ts
  - apps/web/src/test-setup.ts
  - packages/ui/src/components/layout/AppShell.tsx
  - packages/ui/src/components/layout/Header.tsx
  - packages/ui/src/components/session/SessionPickerModal.tsx
  - packages/ui/src/index.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: resolved
resolved_commit: 6c316e8
resolution: All 2 blockers + 6 warnings + 3 of 4 info items fixed in 6c316e8 (IN-02 was a no-op, advisory only). 80 web + 28 ui tests pass; build clean.
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase implements per-tab session persistence with namespaced localStorage keys, an
LRU session registry, a synchronous tab-identity resolver, a boot-time auto-resume resolver,
and a new `SessionPickerModal`. The tab-identity layer, registry LRU logic, and the security
guard on `history.replaceState` are sound and well-tested.

However, two correctness defects in the registry-write path break the core feature: the
`onWrite` callback that maintains the registry uses the **stale, module-level
`tabIdentity.tabId`** rather than the store's currently-active persist key. After any
auto-resume or picker-resume (both of which generate a *new* tabId and call
`persist.setOptions`), registry records are stamped with the wrong (or empty) tabId, so the
session's data keys and registry pointer diverge — auto-resumed sessions become
un-resumable from the picker, and the picker can list ghost entries. A secondary effect is
that `sourceFile` is hardcoded to `null`, so every picker row shows "Untitled."

The new modal also lacks standard dialog accessibility (no Escape-to-close, no focus
management, no focus trap), and several smaller robustness gaps exist around hydration
timing and registry validation.

## Critical Issues

### CR-01: Registry record stamped with stale module-level `tabIdentity.tabId` after resume — auto-resumed sessions become un-resumable

**File:** `apps/web/src/store/mapping-store.ts:153-176` (with `apps/web/src/hooks/useSession.ts:110-128, 229-251`)

**Issue:**
`tabIdentity` is resolved exactly once at module load and is an immutable constant
(`tab-identity.ts:87`). The `onWrite` debounced-storage callback that maintains the session
registry reads `tabIdentity.tabId` directly:

```ts
const existing = readRegistry().find((r) => r.tabId === tabIdentity.tabId);
// ...
const record: SessionRecord = {
  tabId: tabIdentity.tabId,   // <-- stale
  ...
};
```

But both resume paths mutate the live tab identity *without* updating this constant:

- **Auto-resume (D-07)** — `useSession.ts:110-124`: reaches this branch only when
  `tabIdentity.hasIdentity === false`, which means `tabIdentity.tabId === ''` (see
  `tab-identity.ts:83`). It generates `newTabId`, writes it to `sessionStorage`, copies the
  data to `folio-mapper-session-${newTabId}-...`, and calls `persist.setOptions({ name: newTabId-key })`.
- **Picker resume** — `useSession.ts:229-248`: same pattern with a fresh `newTabId`.

After either resume, the store persists to the `newTabId` key, but the next debounced write
fires `onWrite`, which stamps the registry record with the **old** `tabIdentity.tabId`
(empty string in the auto-resume case). Result: the registry contains a record whose
`tabId` does not match the localStorage data keys. The picker's `onResume(tabId)` then looks
up `folio-mapper-session-${tabId}-mapping` and finds nothing (or an empty-string key), so the
session cannot be resumed. In the auto-resume case a record with `tabId: ''` is also written,
producing a ghost "Untitled" picker row pointing at non-existent keys
(`folio-mapper-session--mapping`).

This defeats the central guarantee of the feature (resumable per-tab sessions) for every tab
that was auto-resumed or picker-resumed — i.e., the common multi-tab path.

**Fix:** Derive the active tabId from the store's current persist key at write time instead
of the frozen constant. Parse it back out of `persist.getOptions().name`, or store the
active tabId in a mutable module variable that the resume paths update.

```ts
// session-storage onWrite (mapping-store.ts)
onWrite: (name: string) => {
  // name === the active persist key, e.g. "folio-mapper-session-<tabId>-mapping"
  const m = name.match(/^folio-mapper-session-(.+)-mapping$/);
  const activeTabId = m?.[1];
  if (!activeTabId) return; // placeholder key — nothing to register yet
  const existing = readRegistry().find((r) => r.tabId === activeTabId);
  const record: SessionRecord = { tabId: activeTabId, /* ... */ };
  upsertRegistry(record);
}
```

Additionally, the resume paths should update a shared mutable tab-id reference (e.g. export a
`setActiveTabId()` from `tab-identity.ts`) so all consumers agree on the current identity.

---

### CR-02: Auto-resume / picker-resume races the registry `onWrite` and can stamp a registry record under the placeholder/empty key before re-keying settles

**File:** `apps/web/src/hooks/useSession.ts:123-128, 243-248`

**Issue:**
Both resume paths call `persist.setOptions({ name: newKey })` and then `persist.rehydrate()`,
but they do **not** update the module-level `tabIdentity` and do not guard the registry
`onWrite` against firing for the placeholder key. Because the stores were created with
`name: MAPPING_KEY` where `MAPPING_KEY` is `folio-mapper-session-placeholder-mapping` whenever
`tabIdentity.tabId === ''` (`tab-identity.ts:90-97`), any debounced write that flushes between
module load and the `setOptions` call — or any write whose `onWrite` still reads the empty
`tabIdentity.tabId` (see CR-01) — persists session data to the **placeholder** key while
registering it under an empty/incorrect tabId. The placeholder data key is never read by any
resume path, so that state is silently lost, and the registry accrues a record that points to
nothing.

This is the same root cause as CR-01 (single source of truth for the active tabId) but is
called out separately because it also affects the *data* key, not just the registry pointer:
the placeholder namespace is a live data sink that nothing ever reads back. Without a guard,
a user who lands on the D-07 fallback path and starts working before/around the resolver can
have their work written only to `folio-mapper-session-placeholder-mapping` and lost on next load.

**Fix:** Make the active tabId the single source of truth and set it *before* the stores can
take any write. Resolve `crypto.randomUUID()` for the D-07 case inside `resolveTabIdentity()`
itself (so `MAPPING_KEY`/`INPUT_KEY` are never the placeholder for a real session), and have
`onWrite` early-return when the key is the placeholder:

```ts
if (name.includes('-placeholder-')) return; // never register placeholder writes
```

---

## Warnings

### WR-01: `sourceFile` is hardcoded to `null` — every picker row shows "Untitled"

**File:** `apps/web/src/store/mapping-store.ts:170-173`

**Issue:** The only code path that creates `SessionRecord`s sets `sourceFile: null` with a
comment promising the value "comes from input store parse result." It never does. The
`SessionPickerModal` therefore always renders "Untitled" (`SessionPickerModal.tsx:85`) and the
delete/resume aria-labels are non-distinguishing for users with multiple sessions, undermining
the picker's usability.

**Fix:** Read the filename from the input store at write time. The `onWrite` callback already
runs outside the mapping store; import lazily to avoid the circular-dep concern noted in the
comment:

```ts
import { useInputStore } from './input-store';
// ...
sourceFile: useInputStore.getState().parseResult?.source_filename
  ?? (useInputStore.getState().textInput ? 'Pasted text' : null),
```

### WR-02: `readRegistry` performs an unchecked type assertion on parsed JSON

**File:** `apps/web/src/store/session-registry.ts:22-30`

**Issue:** `JSON.parse(raw) as SessionRecord[]` trusts the localStorage contents without shape
validation. If the stored value is valid JSON but not an array (e.g. an object, a number, or a
truncated/corrupted write — plausible after a QuotaExceeded partial write or a future schema
change), `readRegistry` returns a non-array. Downstream callers then crash: `upsertRegistry`
calls `.findIndex` (`session-registry.ts:48`), `SessionPickerModal` spreads and `.sort`s
(`SessionPickerModal.tsx:31`), and the boot resolver indexes `registry[0]`
(`useSession.ts:104`). A single corrupted registry key bricks the entire session UI with a
runtime TypeError.

**Fix:** Validate that the parsed result is an array (and ideally that elements have a
`tabId`):

```ts
const parsed = JSON.parse(raw);
if (!Array.isArray(parsed)) return [];
return parsed.filter((r) => r && typeof r.tabId === 'string');
```

### WR-03: SessionPickerModal has no Escape-to-close, no initial focus, and no focus trap

**File:** `packages/ui/src/components/session/SessionPickerModal.tsx:35-42`

**Issue:** The modal sets `role="dialog"` and `aria-modal="true"` but implements none of the
behaviors those roles imply: pressing Escape does not close it (no `keydown` handler), focus
is not moved into the dialog on open, and Tab focus is not trapped — keyboard users can tab
into the obscured page behind the overlay. The phase brief explicitly calls out picker
accessibility. The backdrop also does not close on outside click (a lesser concern, but the
overlay div has no `onClick`).

**Fix:** Add an effect that focuses the close button (or first actionable element) on mount,
listen for `Escape` to call `onClose`, and implement a minimal focus trap (or reuse the
project's existing modal primitive if one exists — `PassphraseModal`/`GoToDialog` may already
solve this).

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [onClose]);
```

### WR-04: Boot resolver checks `hasHydrated()` but cannot detect skipped hydration on the auto-resume path, risking a stuck `rehydrated=false`

**File:** `apps/web/src/hooks/useSession.ts:58-87`

**Issue:** The rehydration gate relies on `onFinishHydration` firing for both stores. On a
`?new=1` tab the stores are created with `skipHydration: true` (`mapping-store.ts:695`,
`input-store.ts:85`), so `onFinishHydration` never fires and `hasHydrated()` returns false
indefinitely. The boot effect (`useSession.ts:94-129`) is therefore never enabled — which
happens to be harmless for the `isNewTab` branch (it would early-return anyway), but the
`rehydrated` state stays `false` forever, and any future logic gated on `rehydrated` (or a
consumer reading it) silently never runs. This is a latent correctness trap: the gate
conflates "hydration finished" with "hydration was skipped."

**Fix:** Treat skipped hydration as ready. When `tabIdentity.isNewTab`, set `rehydrated`
immediately rather than waiting on `onFinishHydration`:

```ts
if (tabIdentity.isNewTab) { setRehydrated(true); return; }
```

### WR-05: `flushDebouncedStorage` is a no-op, so `downloadSession`/unload may export stale state

**File:** `apps/web/src/store/session-storage.ts:63-68`

**Issue:** `flushDebouncedStorage` is documented as flushing pending debounced writes "before
download / unload" but its body is empty (a literal no-op). The 5-second debounce
(`DEBOUNCE_MS = 5000`) means up to 5 seconds of the most recent selections/notes may not yet be
persisted. `downloadSession` (`useSession.ts:190-201`) reads from the live store via
`buildSessionFile`, so the *download* path is actually safe — but the function's existence and
comment imply a flush guarantee that does not exist, and any code that relies on localStorage
being current (e.g. the resume-copy paths that `localStorage.getItem` the source keys at
`useSession.ts:118-119, 238-239`) can copy state that is up to 5s stale. Picker-resuming a tab
that was just edited in another tab can lose the last few seconds of edits.

**Fix:** Either implement a real flush (clear timers and write `lastWritten` candidates
synchronously) and call it before resume-copies, or delete the dead function and its comment to
avoid implying a guarantee that isn't there.

### WR-06: Two resume paths duplicate the same key-copy + rehydrate logic verbatim

**File:** `apps/web/src/hooks/useSession.ts:110-128` and `:229-251`

**Issue:** The auto-resume effect and `handlePickerResume` contain near-identical blocks:
generate `newTabId`, write `folio-tab-id`, compute mapping/input keys, copy source keys,
`setOptions`, `Promise.all([rehydrate, rehydrate])`. The only difference is the source tabId
(`mostRecent.tabId` vs the picker argument). Duplicated logic means CR-01/CR-02 must be fixed
in two places, and the two copies can drift. (This duplication is also where the missing
`tabIdentity` update — CR-01 — is replicated.)

**Fix:** Extract a shared `adoptSession(srcTabId: string): void` helper that performs the copy,
re-key, active-tabId update (per CR-01 fix), and rehydrate, and call it from both sites.

---

## Info

### IN-01: Dead/back-compat handlers retained with no call sites

**File:** `apps/web/src/hooks/useSession.ts:253-260, 296-319`

**Issue:** `handleResume` is an explicit no-op kept "for call-site compatibility until App.tsx
is updated," and `getRecoveryData` is described as "kept for backward compatibility with
existing UI." App.tsx (the updated consumer) uses neither. These are dead code paths that
add maintenance surface and confusion.

**Fix:** Remove `handleResume` and `getRecoveryData` (and the now-unused `SessionRecoveryModal`
export at `packages/ui/src/index.ts:52` if nothing else references it), or open a tracking
issue if intentional.

### IN-02: `_formatTimeAgo` is defined but unused in App.tsx

**File:** `apps/web/src/App.tsx:60-69`

**Issue:** `_formatTimeAgo` is invoked only at `App.tsx:165` for the FOLIO badge — actually it
*is* used, so this is not dead code. However, the picker shows raw `toLocaleString()`
timestamps (`SessionPickerModal.tsx:152-158`) rather than the friendlier relative format. Minor
inconsistency in date presentation between the header and the picker.

**Fix:** Consider sharing a single relative-time formatter between App.tsx and the picker for
consistent UX. (No correctness impact.)

### IN-03: Magic strings for localStorage key construction are repeated across four files

**File:** `apps/web/src/hooks/useSession.ts:113-116, 233-236`; `apps/web/src/store/session-registry.ts:63-64, 86-87`; `apps/web/src/store/tab-identity.ts:18,32,90-97`; `apps/web/src/store/mapping-store.ts` (via onWrite)

**Issue:** The `folio-mapper-session-${tabId}-mapping` / `-input` key template is hand-built in
at least four files. A single helper would prevent the kind of pointer/data divergence behind
CR-01 and make the namespacing auditable.

**Fix:** Add `mappingKey(tabId)` / `inputKey(tabId)` helpers in `tab-identity.ts` and use them
everywhere keys are constructed.

### IN-04: `'s'` keyboard shortcut comparison is case-sensitive and ignores capslock/shift

**File:** `apps/web/src/hooks/useSession.ts:132-144`

**Issue:** The Ctrl+S save handler matches `e.key === 's'` exactly. With CapsLock on (or
Shift held), `e.key` is `'S'` and the shortcut silently fails to save. Low impact (the visible
Save button still works) but inconsistent with user expectation.

**Fix:** Compare case-insensitively: `e.key.toLowerCase() === 's'`.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
