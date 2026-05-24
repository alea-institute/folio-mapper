# Phase 3: New (Fresh Session in New Tab) - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/store/tab-identity.ts` | utility | transform | `apps/web/src/store/session-storage.ts` | role-match (storage utility) |
| `apps/web/src/store/session-registry.ts` | store/utility | CRUD | `apps/web/src/store/session-storage.ts` | role-match (storage utility) |
| `apps/web/src/store/session-storage.ts` (modify) | utility | event-driven | self | exact (extending) |
| `apps/web/src/store/input-store.ts` (modify) | store | CRUD | `apps/web/src/store/llm-store.ts` | exact (Zustand persist pattern) |
| `apps/web/src/store/mapping-store.ts` (modify) | store | CRUD | `apps/web/src/store/input-store.ts` | exact (Zustand persist pattern) |
| `apps/web/src/hooks/useSession.ts` (modify) | hook | event-driven | self | exact (extending) |
| `packages/ui/src/components/session/SessionPickerModal.tsx` | component | request-response | `packages/ui/src/components/session/SessionRecoveryModal.tsx` | exact (extend from single to list) |
| `packages/ui/src/components/layout/Header.tsx` (modify) | component | request-response | self | exact (extending) |
| `packages/ui/src/components/layout/AppShell.tsx` (modify) | component | request-response | self | exact (extending) |
| `apps/web/src/App.tsx` (modify) | component | request-response | self | exact (extending) |
| `apps/web/src/store/tab-identity.test.ts` | test | — | `apps/web/src/store/input-store.test.ts` | exact (store unit test pattern) |
| `apps/web/src/store/session-registry.test.ts` | test | — | `apps/web/src/store/demo-store.test.ts` | exact (store unit test pattern with localStorage) |
| `apps/web/src/hooks/useSession.test.ts` | test | — | `apps/web/src/store/mapping-store.test.ts` | role-match |

---

## Pattern Assignments

### `apps/web/src/store/tab-identity.ts` (utility, transform)

**Analog:** `apps/web/src/store/session-storage.ts`

**Imports pattern** (lines 1 of session-storage.ts):
```typescript
import type { StateStorage } from 'zustand/middleware';
```
New file has no external imports — pure Web API use. Pattern: no framework imports, browser globals only (`URLSearchParams`, `sessionStorage`, `localStorage`, `crypto`, `history`).

**Core pattern** — synchronous module-level IIFE exported as constant (no analog exists; pattern from RESEARCH.md):
```typescript
// Module-level synchronous execution — runs before any store is created.
// Result is exported as a frozen constant consumed by store files.

const TABID_SESSIONKEY = 'folio-tab-id';
const LEGACY_MAPPING_KEY = 'folio-mapper-session-mapping';
const LEGACY_INPUT_KEY = 'folio-mapper-session-input';

function resolveTabIdentity(): { tabId: string; isNewTab: boolean; hasIdentity: boolean } {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) {
    const newId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, newId);
    history.replaceState(null, '', window.location.pathname);
    return { tabId: newId, isNewTab: true, hasIdentity: true };
  }
  const existing = sessionStorage.getItem(TABID_SESSIONKEY);
  if (existing) {
    return { tabId: existing, isNewTab: false, hasIdentity: true };
  }
  // Legacy migration path — centralized here, never in individual stores
  const hasLegacyMapping = !!localStorage.getItem(LEGACY_MAPPING_KEY);
  const hasLegacyInput = !!localStorage.getItem(LEGACY_INPUT_KEY);
  if (hasLegacyMapping || hasLegacyInput) {
    const migratedId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, migratedId);
    migrateToNamespacedKeys(migratedId);
    return { tabId: migratedId, isNewTab: false, hasIdentity: true };
  }
  return { tabId: '', isNewTab: false, hasIdentity: false };
}

export const tabIdentity = resolveTabIdentity();
export const MAPPING_KEY = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-mapping`
  : 'folio-mapper-session-placeholder-mapping';
export const INPUT_KEY = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-input`
  : 'folio-mapper-session-placeholder-input';
```

**Error handling pattern** — follow `session-storage.ts` (lines 30-38): wrap localStorage calls in try/catch, swallow `QuotaExceededError` with `console.warn`, rethrow others.

---

### `apps/web/src/store/session-registry.ts` (store/utility, CRUD)

**Analog:** `apps/web/src/store/session-storage.ts`

**Imports pattern:** No framework imports. Pure functions over `localStorage`. Same style as `session-storage.ts` — module with exported named functions only.

**Core CRUD pattern** — copy the try/catch + QuotaExceeded guard from `session-storage.ts` lines 29-38:
```typescript
// From session-storage.ts lines 29-38 — exact QuotaExceeded guard to copy:
try {
  localStorage.setItem(name, value);
  lastWritten.set(name, value);
} catch (e) {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    console.warn('[session-storage] localStorage quota exceeded, skipping write for', name);
  } else {
    throw e;
  }
}
```

**Registry read guard** — mirror the JSON.parse safety pattern from `useSession.ts` lines 263-268:
```typescript
// From useSession.ts lines 263-268 — JSON.parse safety wrapper to copy:
try {
  const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.state?.updated) created = parsed.state.updated;
  }
} catch { /* ignore */ }
```

**Session record shape** (from RESEARCH.md Pattern 4):
```typescript
export interface SessionRecord {
  tabId: string;
  updatedAt: string;   // ISO 8601; bumped only inside debounced setItem, never in store actions
  createdAt: string;   // ISO 8601; set once on first upsert
  totalNodes: number;
  completed: number;
  skipped: number;
  sourceFile: string | null;
}

const REGISTRY_KEY = 'folio-mapper-session-registry';
const MAX_SESSIONS = 5;

export function readRegistry(): SessionRecord[] { ... }
export function upsertRegistry(record: SessionRecord): void { ... }  // enforces LRU + eviction
export function deleteFromRegistry(tabId: string): void { ... }
```

**LRU eviction** — upsert current tab first (bumps updatedAt), then sort desc by updatedAt, splice to MAX_SESSIONS, remove evicted keys from localStorage. This ensures current tab is never evicted (Pitfall 4 from RESEARCH.md).

---

### `apps/web/src/store/session-storage.ts` (modify — extend existing)

**Analog:** Self (extending `createDebouncedStorage`)

**Existing core pattern** (lines 9-53 of session-storage.ts) — `createDebouncedStorage()` returns a `StateStorage` with `getItem`, `setItem`, `removeItem`. The `setItem` fires after `DEBOUNCE_MS = 5000` and calls `localStorage.setItem`.

**Extension point:** Add a `getRegistryRecord` callback parameter so the debounced `setItem` can call `upsertRegistry` when it fires. The callback is optional (default undefined) so existing `llm-store.ts` usage is unchanged.

**Modified signature to copy from existing pattern:**
```typescript
// Existing (session-storage.ts line 9):
export function createDebouncedStorage(): StateStorage {

// Extended version — add optional callback:
export function createDebouncedStorage(
  opts?: { onWrite?: (name: string) => void }
): StateStorage {
  // ... existing body unchanged ...
  // Inside setTimeout callback (after localStorage.setItem succeeds):
  opts?.onWrite?.(name);
  // ...
}
```

**`flushDebouncedStorage`** (lines 56-60) — keep as-is; it is called before export/download.

---

### `apps/web/src/store/input-store.ts` (modify — add skipHydration + namespaced key)

**Analog:** `apps/web/src/store/llm-store.ts` (persist config pattern) AND self (existing partialize/merge)

**Existing imports** (lines 1-4 of input-store.ts — copy exactly, add tab-identity import):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ParseResult, Screen } from '@folio-mapper/core';
import { createDebouncedStorage } from './session-storage';
// ADD:
import { INPUT_KEY, tabIdentity } from './tab-identity';
```

**Existing persist config** (lines 82-102 of input-store.ts — modify `name` and add `skipHydration`):
```typescript
// BEFORE (input-store.ts line 82-83):
{
  name: 'folio-mapper-session-input',
  storage: createJSONStorage(() => debouncedStorage),

// AFTER — swap static name for dynamic, add skipHydration:
{
  name: INPUT_KEY,
  storage: createJSONStorage(() => debouncedStorage),
  skipHydration: tabIdentity.isNewTab,
```

**`partialize` pattern** (lines 84-88 of input-store.ts — keep unchanged):
```typescript
partialize: (state) => ({
  screen: state.screen,
  textInput: state.textInput,
  parseResult: state.parseResult,
}),
```

**`merge` pattern** (lines 89-100 of input-store.ts — keep unchanged):
```typescript
merge: (persisted, current) => {
  const p = persisted as Partial<InputState> | undefined;
  if (!p) return current;
  return {
    ...current,
    ...p,
    selectedFile: null,
    isLoading: false,
    error: null,
  };
},
```

---

### `apps/web/src/store/mapping-store.ts` (modify — add skipHydration + namespaced key)

**Analog:** `apps/web/src/store/input-store.ts` (same modification pattern)

**Existing imports** (lines 1-17 of mapping-store.ts — add tab-identity import):
```typescript
// ADD to existing imports:
import { MAPPING_KEY, tabIdentity } from './tab-identity';
```

**Existing persist config** (lines 668-669 of mapping-store.ts — modify `name` and add `skipHydration`):
```typescript
// BEFORE:
{
  name: 'folio-mapper-session-mapping',
  storage: createJSONStorage(() => debouncedStorage),

// AFTER:
{
  name: MAPPING_KEY,
  storage: createJSONStorage(() => debouncedStorage),
  skipHydration: tabIdentity.isNewTab,
```

**`partialize` pattern** (lines 670-686 of mapping-store.ts — keep entirely unchanged).

**`merge` pattern** (lines 687-709 of mapping-store.ts — keep entirely unchanged, including the `threshold` legacy field strip at line 691).

---

### `apps/web/src/hooks/useSession.ts` (modify — boot resolver + removals)

**Analog:** Self (restructuring existing hook)

**Existing rehydration readiness pattern** (lines 60-89 of useSession.ts — keep unchanged, it works for all paths):
```typescript
// useSession.ts lines 60-89 — keep exactly as-is
useEffect(() => {
  const unsubs: (() => void)[] = [];
  let mappingReady = false;
  let inputReady = false;

  const check = () => {
    if (mappingReady && inputReady) setRehydrated(true);
  };

  const mappingUnsub = useMappingStore.persist.onFinishHydration(() => {
    mappingReady = true; check();
  });
  const inputUnsub = useInputStore.persist.onFinishHydration(() => {
    inputReady = true; check();
  });
  unsubs.push(mappingUnsub, inputUnsub);

  if (useMappingStore.persist.hasHydrated()) mappingReady = true;
  if (useInputStore.persist.hasHydrated()) inputReady = true;
  check();

  return () => unsubs.forEach((u) => u());
}, []);
```

**Boot resolver** — replaces the existing "check for session to recover" effect (lines 92-100 of useSession.ts). New pattern from RESEARCH.md Pattern 3:
```typescript
// REPLACE useSession.ts lines 92-100 with:
const checkedRef = useRef(false);

useEffect(() => {
  if (!rehydrated || checkedRef.current) return;
  checkedRef.current = true;

  if (tabIdentity.isNewTab) return;         // D-01: fresh tab, already clean
  if (tabIdentity.hasIdentity) return;      // D-08: direct hydration already correct

  // D-07: No identity — auto-resume most-recently-modified session
  const registry = readRegistry();
  if (registry.length === 0) return;        // No sessions → stay fresh

  const mostRecent = [...registry].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  // Pitfall 5 fix: adopt data under a NEW tabId (not the original)
  const newTabId = crypto.randomUUID();
  sessionStorage.setItem('folio-tab-id', newTabId);
  const mappingKey = `folio-mapper-session-${newTabId}-mapping`;
  const inputKey = `folio-mapper-session-${newTabId}-input`;
  const srcMapping = `folio-mapper-session-${mostRecent.tabId}-mapping`;
  const srcInput = `folio-mapper-session-${mostRecent.tabId}-input`;
  const mappingData = localStorage.getItem(srcMapping);
  const inputData = localStorage.getItem(srcInput);
  if (mappingData) localStorage.setItem(mappingKey, mappingData);
  if (inputData) localStorage.setItem(inputKey, inputData);

  useMappingStore.persist.setOptions({ name: mappingKey });
  useInputStore.persist.setOptions({ name: inputKey });
  void Promise.all([
    useMappingStore.persist.rehydrate(),
    useInputStore.persist.rehydrate(),
  ]);
}, [rehydrated]);
```

**Ctrl+S handler** (lines 115-127 of useSession.ts — keep unchanged).

**`buildSessionFile`** (lines 129-171 — keep unchanged).

**`downloadSession`** (lines 173-184 — keep unchanged).

**`clearStores`** (lines 186-192 of useSession.ts — update to use namespaced keys):
```typescript
// BEFORE (useSession.ts lines 186-192):
const clearStores = useCallback(() => {
  useMappingStore.getState().resetMapping();
  useInputStore.getState().reset();
  localStorage.removeItem(MAPPING_STORAGE_KEY);
  localStorage.removeItem(INPUT_STORAGE_KEY);
}, []);

// AFTER — use store's actual persist name (dynamic):
const clearStores = useCallback(() => {
  useMappingStore.getState().resetMapping();
  useInputStore.getState().reset();
  const mappingKey = useMappingStore.persist.getOptions().name;
  const inputKey = useInputStore.persist.getOptions().name;
  if (mappingKey) localStorage.removeItem(mappingKey);
  if (inputKey) localStorage.removeItem(inputKey);
}, []);
```

**`handleNewTab`** — new callback to add (D-01), pattern from App.tsx `useCallback` style:
```typescript
// New callback — add after clearStores, matching App.tsx useCallback style
const handleNewTab = useCallback(() => {
  window.open(window.location.pathname + '?new=1', '_blank');
}, []);
```

**`showRecoveryModal` state** (line 54 of useSession.ts) — remove this state; `SessionRecoveryModal` is replaced by `SessionPickerModal` which is on-demand, not startup-gated.

**DELETIONS** (from RESEARCH.md removals scope table):
- `showNewProjectModal` state (line 55) — delete
- `beforeunload` handler useEffect (lines 103-112) — delete entire useEffect
- `handleNewProject` (lines 207-209) — delete
- `handleSaveAndNew` (lines 211-215) — delete
- `handleDiscardAndNew` (lines 217-220) — delete
- `handleCancelNewProject` (lines 222-224) — delete
- Return object entries for the 4 deleted handlers + `showNewProjectModal` (lines 248-252) — delete

**Session picker trigger** — add `showSessionPicker` state and `handleOpenSessionPicker` / `handleCloseSessionPicker` callbacks following the existing `showRecoveryModal` pattern (line 54).

---

### `packages/ui/src/components/session/SessionPickerModal.tsx` (new component)

**Analog:** `packages/ui/src/components/session/SessionRecoveryModal.tsx` (extend from single session to list)

**Existing modal shell pattern** (lines 23-26 of SessionRecoveryModal.tsx — copy exactly):
```tsx
// SessionRecoveryModal.tsx lines 23-26 — modal shell to copy
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
  <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
       role="dialog" aria-modal="true" aria-label="Session recovery">
```

**Existing header pattern** (line 27):
```tsx
<h2 className="mb-4 text-lg font-semibold text-gray-900">Session Recovery</h2>
```
New file: use "Open Recent Session" or "Saved Sessions" as heading.

**Existing metadata display pattern** (lines 28-37 of SessionRecoveryModal.tsx — copy per-row metadata style):
```tsx
// Per-session row: show same metadata fields as SessionRecoveryModal
<p className="mb-1 text-sm text-gray-600">
  Found saved session from: <span className="font-medium text-gray-800">{formattedDate}</span>
</p>
<p className="mb-1 text-sm text-gray-600">
  Progress: <span className="font-medium text-gray-800">{completedCount} of {totalNodes} nodes ({pct}%)</span>
</p>
```

**Existing button pattern** (lines 39-58 of SessionRecoveryModal.tsx — copy button styles):
```tsx
// Primary action (Resume):
className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"

// Secondary actions (Delete, Start New):
className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
```

**Props interface** (from RESEARCH.md Pattern 5 / Session Picker section):
```typescript
interface SessionPickerModalProps {
  sessions: SessionRecord[];       // sorted by updatedAt desc; from readRegistry()
  currentTabId: string;            // highlight current session row
  onResume: (tabId: string) => void;
  onDelete: (tabId: string) => void;
  onStartNew: () => void;          // calls handleNewTab → window.open
  onClose: () => void;
}
```

**`formatDate` helper** (lines 64-70 of SessionRecoveryModal.tsx — copy verbatim):
```typescript
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
```

---

### `packages/ui/src/components/layout/Header.tsx` (modify)

**Analog:** Self (targeted prop/guard changes only)

**Existing "New" button block** (lines 95-115 of Header.tsx) — the block to rewrite:
```tsx
// BEFORE (Header.tsx lines 95-115):
{hasActiveSession && onNewProject && (
  <div className="relative">
    <button
      onClick={onNewProject}
      className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      title="Start New Project"
      aria-label="New project"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New
    </button>
    {newProjectPopover}
  </div>
)}
```

**D-10/D-11 changes:** Remove `hasActiveSession &&` guard, remove `newProjectPopover` slot, rename prop `onNewProject` → `onNewTab`. Button becomes always-rendered when `onNewTab` is provided.

**Clock icon button** — add next to "New" button (same button class pattern from lines 96-113):
```tsx
// "Open recent" clock icon button — add after "New" button
{onOpenSessionPicker && (
  <button
    onClick={onOpenSessionPicker}
    className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
    title="Open recent session"
    aria-label="Open recent session"
  >
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
    </svg>
  </button>
)}
```

**Props interface changes** (lines 7-22 of Header.tsx):
- Remove: `onNewProject?: () => void`, `hasActiveSession?: boolean`, `newProjectPopover?: ReactNode`
- Add: `onNewTab?: () => void`, `onOpenSessionPicker?: () => void`
- Remove: `import type { ReactNode } from 'react'` if no longer used

---

### `packages/ui/src/components/layout/AppShell.tsx` (modify)

**Analog:** Self (add props, pass to Header)

**Existing AppShellProps** (lines 4-14 of AppShell.tsx — add new props):
```typescript
// BEFORE (AppShell.tsx lines 4-14):
interface AppShellProps {
  children: ReactNode;
  onOpenSettings?: () => void;
  onOpenFolioModal?: () => void;
  llmStatus?: 'connected' | 'disconnected' | 'none';
  llmProviderLabel?: string;
  embeddingStatus?: 'ready' | 'building' | 'unavailable' | 'none';
  embeddingDetail?: string;
  folioUpdateStatus?: 'current' | 'checking' | 'updating' | 'updated' | 'error' | 'none';
  folioUpdateDetail?: string;
}

// AFTER — add two new optional props:
  onNewTab?: () => void;
  onOpenSessionPicker?: () => void;
```

**Existing Header call** (line 19 of AppShell.tsx — add new props to pass-through):
```tsx
// BEFORE:
<Header onOpenSettings={onOpenSettings} onOpenFolioModal={onOpenFolioModal} ... />

// AFTER — add:
<Header ... onNewTab={onNewTab} onOpenSessionPicker={onOpenSessionPicker} />
```

---

### `apps/web/src/App.tsx` (modify — wiring)

**Analog:** Self (targeted changes)

**Existing import list** (lines 1-33 of App.tsx — changes):
- Remove `NewProjectModal` from line 25
- Add `SessionPickerModal` to the `@folio-mapper/ui` import
- Add `import { tabIdentity } from './store/tab-identity'` (line order: after store imports)
- Add `import { readRegistry, deleteFromRegistry } from './store/session-registry'`

**Existing `useCallback` pattern** for new-tab handler (matches style of existing handlers in App.tsx):
```typescript
// Copy useCallback style from App.tsx existing handlers
const handleNewTab = useCallback(() => {
  window.open(window.location.pathname + '?new=1', '_blank');
}, []);
```

**Mapping screen Header** (App.tsx lines 700-727) — remove `onNewProject`, `newProjectPopover`, add `onNewTab` and `onOpenSessionPicker`:
```tsx
// BEFORE (App.tsx lines 711-727):
onNewProject={session.handleNewProject}
hasActiveSession={session.hasActiveSession}
newProjectPopover={session.showNewProjectModal ? (
  <NewProjectModal ... />
) : null}

// AFTER:
onNewTab={handleNewTab}
onOpenSessionPicker={session.handleOpenSessionPicker}
```

**Input/confirming screens** — both render via `AppShell`; add `onNewTab` and `onOpenSessionPicker` to AppShell props (lines ~990-1109 of App.tsx).

**Recovery modal replacement** (App.tsx lines ~975-988) — remove `SessionRecoveryModal` forced gate; add `SessionPickerModal` as on-demand (gated by `session.showSessionPicker`):
```tsx
// Remove the forced startup gate:
// {recoveryData && <SessionRecoveryModal ... />}

// Replace with on-demand picker (not a startup gate):
{session.showSessionPicker && (
  <SessionPickerModal
    sessions={readRegistry()}
    currentTabId={tabIdentity.tabId}
    onResume={(tabId) => { /* setOptions + rehydrate */ session.handlePickerResume(tabId); }}
    onDelete={(tabId) => { deleteFromRegistry(tabId); }}
    onStartNew={handleNewTab}
    onClose={session.handleCloseSessionPicker}
  />
)}
```

---

## Shared Patterns

### Zustand `persist` Config (partialize + merge)
**Source:** `apps/web/src/store/input-store.ts` lines 82-102, `apps/web/src/store/mapping-store.ts` lines 668-710
**Apply to:** `input-store.ts` and `mapping-store.ts` modifications (keep existing `partialize` and `merge` blocks entirely unchanged — only `name` and `skipHydration` change)

```typescript
// Pattern: name + storage + skipHydration + partialize + merge
{
  name: DYNAMIC_KEY,                           // from tab-identity.ts
  storage: createJSONStorage(() => debouncedStorage),
  skipHydration: tabIdentity.isNewTab,         // true only for ?new=1 tabs
  partialize: (state) => ({ /* unchanged */ }),
  merge: (persisted, current) => { /* unchanged */ },
}
```

### localStorage Error Handling
**Source:** `apps/web/src/store/session-storage.ts` lines 29-38
**Apply to:** `session-registry.ts`, `tab-identity.ts` (any localStorage write)

```typescript
try {
  localStorage.setItem(name, value);
} catch (e) {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    console.warn('[session-storage] localStorage quota exceeded, skipping write for', name);
  } else {
    throw e;
  }
}
```

### JSON.parse Safety
**Source:** `apps/web/src/hooks/useSession.ts` lines 263-268
**Apply to:** `session-registry.ts` `readRegistry()`, any localStorage JSON read

```typescript
try {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SessionRecord[];
} catch { return []; }
```

### React Component Modal Shell
**Source:** `packages/ui/src/components/session/SessionRecoveryModal.tsx` lines 23-26
**Apply to:** `SessionPickerModal.tsx`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
  <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
       role="dialog" aria-modal="true" aria-label="...">
```

### Header Button Style
**Source:** `packages/ui/src/components/layout/Header.tsx` lines 96-113
**Apply to:** New clock icon button in `Header.tsx`

```tsx
className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
```

### Vitest Unit Test Structure (store)
**Source:** `apps/web/src/store/input-store.test.ts` lines 1-111
**Apply to:** `tab-identity.test.ts`, `session-registry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// No React Testing Library needed for pure utility/store tests

describe('module-name', () => {
  beforeEach(() => {
    // Reset store or clear localStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  it('behavior description', () => {
    // Arrange → Act → Assert
    expect(result).toBe(expected);
  });
});
```

### Vitest Unit Test Structure (localStorage assertions)
**Source:** `apps/web/src/store/demo-store.test.ts` lines 88-102
**Apply to:** `session-registry.test.ts` (registry key assertions)

```typescript
// Pattern: snapshot localStorage keys before/after to assert side effects
const before = new Set(Object.keys(localStorage));
// ... act ...
const after = Object.keys(localStorage);
const newKeys = after.filter((key) => !before.has(key));
expect(newKeys).toEqual([expectedKey]);
```

### `useCallback` Handler Pattern
**Source:** `apps/web/src/hooks/useSession.ts` lines 194-224 (existing handlers)
**Apply to:** All new handlers in `useSession.ts`

```typescript
const handlerName = useCallback(() => {
  // side effect
}, [dependency]);  // or [] for stable handlers
```

---

## Deletions (No Analog — Remove Entirely)

Files/symbols to delete with no replacement pattern needed:

| File | Lines | Symbol | Action |
|------|-------|--------|--------|
| `packages/ui/src/components/session/NewProjectModal.tsx` | entire file | `NewProjectModal` | Delete file |
| `packages/ui/src/index.ts` | (grep for NewProjectModal) | `NewProjectModal` export | Remove from barrel |
| `apps/web/src/App.tsx` | 25 | `NewProjectModal` import | Remove from import list |
| `apps/web/src/hooks/useSession.ts` | 55 | `showNewProjectModal` useState | Delete |
| `apps/web/src/hooks/useSession.ts` | 103-112 | `beforeunload` useEffect | Delete entire useEffect |
| `apps/web/src/hooks/useSession.ts` | 207-224 | 4 `handleNewProject*` functions | Delete all four |
| `apps/web/src/hooks/useSession.ts` | 248-252 | Return props for deleted handlers | Delete from return object |
| `packages/ui/src/components/layout/Header.tsx` | 95 | `hasActiveSession &&` guard | Remove conditional |
| `packages/ui/src/components/layout/Header.tsx` | 11, 21, 22 | `onNewProject`, `newProjectPopover`, `hasActiveSession` props | Remove from interface + destructure |

---

## No Analog Found

All files have analogs in the codebase. The `tab-identity.ts` module (synchronous pre-store resolver) has no direct role analog since this is the first module-level side-effect file in the project — the closest analog is `session-storage.ts` (a pure utility with no React/Zustand dependencies). Planner should use RESEARCH.md Pattern 1 directly for its implementation.

---

## Metadata

**Analog search scope:** `apps/web/src/store/`, `apps/web/src/hooks/`, `packages/ui/src/components/session/`, `packages/ui/src/components/layout/`, `apps/web/src/`
**Files scanned:** 13 source files + 4 test files
**Pattern extraction date:** 2026-05-22
