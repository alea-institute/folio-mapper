# Phase 3: New (Fresh Session in New Tab) - Research

**Researched:** 2026-05-22
**Domain:** Frontend session architecture — multi-tab localStorage namespacing, Zustand persist, React lifecycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "New" opens a fresh browser tab (`window.open(pathname + '?new=1', '_blank')`), current tab untouched. Replaces in-place reset.
- **D-02:** Delete `NewProjectModal` + `handleNewProject` / `handleSaveAndNew` / `handleDiscardAndNew` in-place-reset flow in `useSession.ts`.
- **D-03:** Clicking "New" is instant — no confirmation prompt.
- **D-04:** Sessions become persistent & recoverable per tab. Each tab persists its own session under a namespaced localStorage key.
- **D-05:** Tab identity rides in `sessionStorage`. On `?new=1`, generate new tab identity, start fresh, strip param via `history.replaceState`.
- **D-06:** Existing single-session localStorage data migrated/adopted gracefully — no in-progress work lost on upgrade.
- **D-07:** Auto-resume on return: brand-new tab with no sessionStorage identity + saved sessions exist → auto-restore most-recently-active session. Zero clicks, no modal gate.
- **D-07b:** Session picker ships as on-demand affordance in the header (not a forced gate). Resume / Start New / Delete per entry.
- **D-08:** Refresh within existing tab → recover that tab's own session directly.
- **D-09:** Cap stored sessions at ~5 (LRU eviction by least-recently-active).
- **D-10:** "New" button always visible — input, confirming, AND mapping screens.
- **D-11:** Label is "New" with existing plus icon.
- **D-12:** Remove `beforeunload` warning.
- **D-13:** Persistence survives full browser close/reboot (data in localStorage, tab identity in sessionStorage).
- **D-14:** "Most-recent" = last-modified (`updatedAt` timestamp, bumped on any state mutation).

### Claude's Discretion
- Exact namespaced-key scheme and tab-id generation (uuid vs counter).
- Session picker visual design (modal vs full-screen) — should reuse existing modal patterns.
- On-demand entry point for session picker (D-07b).
- Where/how the always-visible "New" button mounts on input/confirming screens.
- Existing startup `SessionRecoveryModal` replaced by silent auto-restore + on-demand picker.

### Deferred Ideas (OUT OF SCOPE)
- Live cross-tab sync (real-time reflection of edits between open tabs).
- Server-side / cloud session storage.
- Session rename / labeling in the picker.
</user_constraints>

---

## Summary

This phase reworks folio-mapper's session persistence from a single shared `localStorage` bucket to a per-tab namespaced model. It mirrors the folio-enrich "New" button pattern exactly, extended for a React/Zustand app that needs long-term persistence (not just in-tab sessionStorage caching as folio-enrich uses).

The three hardest problems are: (1) making Zustand `persist` middleware use a **dynamic storage key** resolved at boot time (before rehydration fires), (2) implementing a clean **boot resolver** that branches across three entry paths without flashing restored state, and (3) migrating **legacy single-session data** on first upgrade without losing work.

All three have concrete, verified solutions. The key insight for the Zustand problem is the `skipHydration: true` + `setOptions({ name: tabKey })` + `rehydrate()` pattern: stores are created with hydration disabled, the tab identity is resolved synchronously at app boot from `sessionStorage` / URL params / legacy migration, then `setOptions` rewires the storage key before `rehydrate()` fires. This runs before any React rendering, avoiding the flash-of-restored-state problem.

**Primary recommendation:** Implement tab identity resolution as a synchronous module-level call in `apps/web/src/store/tab-identity.ts` that runs before store creation. All per-tab store `name` values derive from this resolved tab ID. The session registry (index of all saved sessions) lives under a single, non-namespaced localStorage key `folio-mapper-session-registry`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab identity generation | Browser / Client (module boot) | — | Must resolve synchronously before React mounts; sessionStorage is client-only |
| Per-tab session write path | Browser / Client (Zustand persist) | — | Zustand persist middleware owns localStorage I/O via debounced adapter |
| Session registry (LRU index) | Browser / Client (storage adapter) | — | Registry must be updated on every session write; lives alongside the debounced adapter |
| Boot resolver / branch dispatch | Browser / Client (React root effect) | — | Runs after hydration; controls which of 3 boot paths fires |
| ?new=1 detection | Browser / Client (pre-render) | — | Must strip URL param before React hydration reads store state |
| Session picker UI | Browser / Client (React modal) | — | Purely presentational; reads registry + per-session metadata |
| Always-visible "New" button | Browser / Client (AppShell) | — | AppShell already wraps input/confirming; mapping screen uses standalone Header |
| LLM settings (folio-mapper-llm) | Browser / Client (Zustand persist, global) | — | Intentionally NOT per-tab; stays on fixed key |

---

## Standard Stack

### Core (all already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | 5.0.11 (installed) | Persist middleware for per-tab stores | Already used; `setOptions` + `skipHydration` + `rehydrate()` confirmed in installed source |
| `crypto.randomUUID()` | Web API (built-in) | Tab ID generation | Already used in `App.tsx`; no new dependency |
| `sessionStorage` | Web API (built-in) | Per-tab identity pointer (dies on tab close) | Correct semantics for tab-scoped, refresh-surviving identity |
| `localStorage` | Web API (built-in) | Long-term session data + registry | Survives full browser close; fits D-13 |

### No New Dependencies Required

This phase is a pure refactor of the session storage layer + new UI components assembled from existing patterns. No npm installs needed.

**Version verification:** `zustand@5.0.11` confirmed in `apps/web/node_modules/zustand/package.json`. `setOptions`, `skipHydration`, `rehydrate` confirmed present in `apps/web/node_modules/zustand/middleware.js`. [VERIFIED: npm registry + codebase grep]

---

## Package Legitimacy Audit

No new packages are being installed in this phase. The only dependencies are already-installed project libraries (`zustand@5.0.11`) and native browser Web APIs.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
App boot (before React render)
        │
        ▼
┌─────────────────────────────────────────────┐
│          tab-identity.ts (module-level)      │
│  1. URLSearchParams.has('new') ?             │
│     → generate new tabId, store in          │
│       sessionStorage, history.replaceState   │
│  2. else sessionStorage.get('folio-tab-id') │
│     → found: use existing tabId (refresh)    │
│  3. else: tabId = null (new blank tab)       │
│  export: { tabId, isNewTab, hasIdentity }    │
└────────────────────┬────────────────────────┘
                     │ tabId (string | null)
                     ▼
┌─────────────────────────────────────────────┐
│     Zustand stores created (skipHydration)   │
│  useInputStore  → name: 'folio-mapper-...'  │
│  useMappingStore → name: 'folio-mapper-...' │
│  (names set via setOptions() before boot)   │
└────────────────────┬────────────────────────┘
                     │ rehydrate() called
                     ▼
┌─────────────────────────────────────────────┐
│           App.tsx useEffect (boot resolver)  │
│                                              │
│  isNewTab ──────────────────► fresh state   │
│  hasIdentity ───────────────► direct recover│
│  !hasIdentity + sessions exist ► auto-resume│
│  !hasIdentity + no sessions ───► fresh state│
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│            Session Registry                  │
│  localStorage key: folio-mapper-session-reg  │
│  Array<{ tabId, updatedAt, metadata }>       │
│  Updated on every debounced write            │
│  Enforces LRU cap (~5) on write              │
└─────────────────────────────────────────────┘
```

### Recommended Project Structure

New files:
```
apps/web/src/store/
├── tab-identity.ts          # Synchronous tab ID resolver (module-level side effect)
├── session-registry.ts      # Registry read/write/eviction (pure functions)
├── session-storage.ts       # (existing) — extend createDebouncedStorage to accept tabId
├── input-store.ts           # (existing) — add skipHydration: true
└── mapping-store.ts         # (existing) — add skipHydration: true

apps/web/src/hooks/
└── useSession.ts            # (existing) — remove D-02/D-12 code; add boot resolver logic

packages/ui/src/components/session/
├── NewProjectModal.tsx      # DELETE (D-02)
├── SessionRecoveryModal.tsx # Repurpose as SessionPickerModal
└── SessionPickerModal.tsx   # NEW — multi-session list picker (or rename/extend existing)

packages/ui/src/components/layout/
├── AppShell.tsx             # Add onNewTab prop → surfaces "New" button on input/confirming
└── Header.tsx               # Change "New" to window.open behavior; add "Open Recent" trigger
```

### Pattern 1: Tab Identity Module (Synchronous Pre-Store Resolution)

**What:** A module that runs synchronously at import time (before any store is created) to establish tab identity.

**When to use:** Called once at module level before store definitions.

**Key design:** This is NOT a React hook or effect — it is module-level imperative code that runs at import time. This guarantees the tabId is available synchronously when the stores are defined.

```typescript
// apps/web/src/store/tab-identity.ts
// Source: folio-enrich pattern (lines 3593-3595) + Zustand skipHydration pattern

const TABID_SESSIONKEY = 'folio-tab-id';
const LEGACY_MAPPING_KEY = 'folio-mapper-session-mapping';
const LEGACY_INPUT_KEY = 'folio-mapper-session-input';

function resolveTabIdentity(): { tabId: string; isNewTab: boolean; hasIdentity: boolean } {
  // D-01/D-05: ?new=1 detection (folio-enrich pattern, lines 3593-3595)
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) {
    const newId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, newId);
    history.replaceState(null, '', window.location.pathname);
    return { tabId: newId, isNewTab: true, hasIdentity: true };
  }

  // D-08: Refresh path — existing tab identity in sessionStorage
  const existing = sessionStorage.getItem(TABID_SESSIONKEY);
  if (existing) {
    return { tabId: existing, isNewTab: false, hasIdentity: true };
  }

  // D-06: Legacy migration check — single-session data exists, no tab identity
  // Adopt it as 'most-recent' by generating an ID and migrating the keys
  const hasLegacyMapping = !!localStorage.getItem(LEGACY_MAPPING_KEY);
  const hasLegacyInput = !!localStorage.getItem(LEGACY_INPUT_KEY);
  if (hasLegacyMapping || hasLegacyInput) {
    const migratedId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, migratedId);
    // Migrate legacy keys to namespaced keys
    migrateToNamespacedKeys(migratedId);
    return { tabId: migratedId, isNewTab: false, hasIdentity: true };
  }

  // D-07: No identity, no legacy data — boot resolver will handle (auto-resume or fresh)
  return { tabId: '', isNewTab: false, hasIdentity: false };
}

function migrateToNamespacedKeys(tabId: string): void {
  // Copy legacy data to namespaced keys, then remove legacy keys
  const legacyMapping = localStorage.getItem(LEGACY_MAPPING_KEY);
  if (legacyMapping) {
    localStorage.setItem(`folio-mapper-session-${tabId}-mapping`, legacyMapping);
    localStorage.removeItem(LEGACY_MAPPING_KEY);
  }
  const legacyInput = localStorage.getItem(LEGACY_INPUT_KEY);
  if (legacyInput) {
    localStorage.setItem(`folio-mapper-session-${tabId}-input`, legacyInput);
    localStorage.removeItem(LEGACY_INPUT_KEY);
  }
}

// Resolved synchronously at module load time
export const tabIdentity = resolveTabIdentity();
export const MAPPING_KEY = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-mapping`
  : 'folio-mapper-session-placeholder-mapping';
export const INPUT_KEY = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-input`
  : 'folio-mapper-session-placeholder-input';
```

### Pattern 2: Zustand skipHydration + setOptions + rehydrate

**What:** Stores are created with `skipHydration: true` and a temporary/placeholder name. Before the React app renders, `setOptions({ name: actualKey })` is called and then `rehydrate()` is triggered. This is the only safe way to wire a runtime-derived key into Zustand persist.

**When to use:** Whenever the persist storage key depends on a value not known at module definition time (e.g., a tab ID from sessionStorage).

**Verified APIs in Zustand 5.0.11:** [VERIFIED: codebase grep of `apps/web/node_modules/zustand/middleware.js`]
- `store.persist.setOptions(newOptions)` — merges new options into persist config
- `store.persist.rehydrate()` — manually triggers hydration (synchronous for localStorage)
- `skipHydration: true` — prevents auto-hydration at store creation

```typescript
// apps/web/src/store/input-store.ts (modified)
// Source: Zustand docs + verified in middleware.js

import { tabIdentity, INPUT_KEY } from './tab-identity';

export const useInputStore = create<InputState>()(
  persist(
    (set, get) => ({ /* ... unchanged state/actions ... */ }),
    {
      name: INPUT_KEY,  // Set to namespaced key immediately (tab-identity is synchronous)
      storage: createJSONStorage(() => debouncedStorage),
      skipHydration: tabIdentity.isNewTab, // Skip hydration for ?new=1 tabs
      partialize: (state) => ({ /* ... unchanged ... */ }),
      merge: (persisted, current) => { /* ... unchanged ... */ },
    },
  ),
);

// For the ?new=1 case, stores skip hydration entirely (start fresh).
// For all other cases, tabId is known at module load time, so name is
// already correct — no setOptions() call needed.
// The no-identity case (D-07) uses a placeholder key; the boot resolver
// calls setOptions + rehydrate after selecting which session to load.
```

**Simpler alternative for known-identity paths:** When `tabIdentity.hasIdentity === true` and `!isNewTab`, the key is already correct at module load time, so standard hydration fires normally — `skipHydration` is only needed for `?new=1` tabs and the no-identity (D-07 auto-resume) path.

### Pattern 3: Boot Resolver (useSession.ts refactor)

**What:** After stores have hydrated (or skipped hydration), a single resolved `bootPath` determines what the user sees on mount.

**Three boot paths:**

| Condition | Path | Action |
|-----------|------|--------|
| `tabIdentity.isNewTab === true` | fresh | Stores already skipped hydration; nothing to do |
| `tabIdentity.hasIdentity === true && !isNewTab` | direct recover | Stores hydrated from that tab's namespaced key; nothing to do |
| `tabIdentity.hasIdentity === false` | auto-resume or fresh | Read registry; find most-recently-modified session; call `setOptions({ name: mostRecentKey })` + `rehydrate()` on both stores; if no sessions → stay fresh |

```typescript
// apps/web/src/hooks/useSession.ts (boot resolver section, replaces showRecoveryModal logic)
// Source: Derived from CONTEXT.md D-07/D-08 + Zustand setOptions pattern

useEffect(() => {
  if (!rehydrated || checkedRef.current) return;
  checkedRef.current = true;

  if (tabIdentity.isNewTab) return; // D-01: fresh tab, nothing to recover
  if (tabIdentity.hasIdentity) return; // D-08: direct recovery already hydrated

  // D-07: No identity — find most-recent session in registry
  const registry = readRegistry();
  if (registry.length === 0) return; // No sessions to restore — stay fresh

  const mostRecent = registry.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  // Split-brain safety (see Pitfall 5): do NOT adopt the most-recent tabId.
  // Generate a NEW identity for this tab and COPY the most-recent session's data into it,
  // so two tabs can never share one tabId and clobber each other's writes.
  const newTabId = crypto.randomUUID();
  sessionStorage.setItem('folio-tab-id', newTabId);

  const sourceMappingKey = `folio-mapper-session-${mostRecent.tabId}-mapping`;
  const sourceInputKey = `folio-mapper-session-${mostRecent.tabId}-input`;
  const mappingKey = `folio-mapper-session-${newTabId}-mapping`;
  const inputKey = `folio-mapper-session-${newTabId}-input`;

  const mappingData = localStorage.getItem(sourceMappingKey);
  const inputData = localStorage.getItem(sourceInputKey);
  if (mappingData) localStorage.setItem(mappingKey, mappingData);
  if (inputData) localStorage.setItem(inputKey, inputData);

  // Own the NEW namespaced keys, then rehydrate from them
  useMappingStore.persist.setOptions({ name: mappingKey });
  useInputStore.persist.setOptions({ name: inputKey });

  void Promise.all([
    useMappingStore.persist.rehydrate(),
    useInputStore.persist.rehydrate(),
  ]);
}, [rehydrated]);
```

**Important (see Pitfall 5):** The no-identity auto-resume path does NOT adopt the most-recent session's `tabId`. It mints a NEW `crypto.randomUUID()` tabId and copies the most-recent session's data under that new namespaced key, then owns the new key. This prevents the split-brain failure where two tabs share one tabId and overwrite each other's work. The original session's data remains under its original tabId in localStorage, still available in the picker.

### Pattern 4: Session Registry

**What:** A single, non-namespaced localStorage key holds an array of session metadata records. Updated on every debounced write. Enforces LRU cap.

**Key scheme:**
- Per-tab mapping data: `folio-mapper-session-{tabId}-mapping`
- Per-tab input data: `folio-mapper-session-{tabId}-input`
- Global registry: `folio-mapper-session-registry`
- LLM settings (unchanged): `folio-mapper-llm`

```typescript
// apps/web/src/store/session-registry.ts
// Source: Derived from CONTEXT.md D-09/D-14

export interface SessionRecord {
  tabId: string;
  updatedAt: string;   // ISO 8601, bumped on every write
  createdAt: string;   // ISO 8601, set once on first write
  totalNodes: number;  // From mapping state
  completed: number;   // Completed node count
  skipped: number;     // Skipped node count
  sourceFile: string | null;
}

const REGISTRY_KEY = 'folio-mapper-session-registry';
const MAX_SESSIONS = 5;

export function readRegistry(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionRecord[];
  } catch { return []; }
}

export function upsertRegistry(record: SessionRecord): void {
  const registry = readRegistry();
  const idx = registry.findIndex((r) => r.tabId === record.tabId);
  if (idx >= 0) {
    registry[idx] = record;
  } else {
    registry.push(record);
  }

  // LRU eviction: sort by updatedAt desc, keep top MAX_SESSIONS
  registry.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const evicted = registry.splice(MAX_SESSIONS);
  // Clean up evicted sessions' data from localStorage
  for (const e of evicted) {
    localStorage.removeItem(`folio-mapper-session-${e.tabId}-mapping`);
    localStorage.removeItem(`folio-mapper-session-${e.tabId}-input`);
  }

  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch { /* QuotaExceeded — swallow, consistent with existing pattern */ }
}

export function deleteFromRegistry(tabId: string): void {
  const registry = readRegistry().filter((r) => r.tabId !== tabId);
  localStorage.removeItem(`folio-mapper-session-${tabId}-mapping`);
  localStorage.removeItem(`folio-mapper-session-${tabId}-input`);
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}
```

**Integration with debounced write path:** `createDebouncedStorage()` in `session-storage.ts` is extended to accept a `getRegistryRecord: () => SessionRecord` callback. When a debounced write fires for a mapping key, it also calls `upsertRegistry(getRegistryRecord())`.

### Pattern 5: Always-Visible "New" Button (D-10)

**What:** The button must appear on all three screens. AppShell wraps input/confirming; the mapping screen renders its own `<Header>`.

**Cleanest approach:** Add `onNewTab?: () => void` prop to `AppShell` and pass it through to the embedded `<Header>`. The mapping screen's standalone `<Header>` already accepts `onNewProject` — rename/repurpose this prop. One handler in `App.tsx`:

```typescript
// In App.tsx
const handleNewTab = useCallback(() => {
  window.open(window.location.pathname + '?new=1', '_blank');
}, []);
```

Pass `onNewTab={handleNewTab}` to both `AppShell` (input/confirming) and `<Header>` (mapping screen).

**Header change:** The current "New" button is conditional on `hasActiveSession` (line 95 of Header.tsx). D-10 requires it to be **always visible** — remove the `hasActiveSession &&` guard. The button's action changes from `onNewProject` (opens NewProjectModal) to `onNewTab` (window.open). The `newProjectPopover` prop and slot are deleted.

**AppShell change:** Add `onNewTab` prop to `AppShellProps` interface; pass to the internal `<Header>`. The internal Header call currently omits `onNewProject` / `hasActiveSession` / `newProjectPopover` — add `onNewTab`.

### Anti-Patterns to Avoid

- **Setting `name` after hydration fires:** Zustand's `persist` calls `hydrate()` synchronously at module load if `skipHydration` is not set. If you import a store and then try to `setOptions` before using the store, it's too late — hydration already ran from the old key. Always use `skipHydration: true` for stores with dynamic keys.

- **Using sessionStorage to store the actual session data:** folio-enrich stores its cache in `sessionStorage` (per-tab automatically, but dies on browser close). folio-mapper must survive browser close (D-13), so session data MUST stay in `localStorage`. `sessionStorage` is used only for the tab identity pointer.

- **Scanning localStorage keys to enumerate sessions:** `localStorage.key(i)` iteration is O(n) over all keys and is fragile across extensions/other apps sharing the origin. The registry key (`folio-mapper-session-registry`) eliminates this need.

- **Attempting to pass tabId via React Context at app boot:** Tab identity must be available before React renders (to avoid flash-of-recovered-state on the `?new=1` path). Module-level synchronous resolution is the correct pattern.

- **Mutating registry on every store action:** Only the debounced write path (when the timer fires and data is actually written to localStorage) should update the registry. This keeps `updatedAt` semantically tied to "last persisted" rather than "last in-memory mutation."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab ID generation | Custom counter or timestamp-based ID | `crypto.randomUUID()` | Already used in App.tsx; collision-free, no deps |
| Dynamic Zustand key | Store factory / Context-provider pattern | `skipHydration` + `setOptions` + `rehydrate()` | Official Zustand 5 API; confirmed in installed middleware.js |
| Session enumeration | localStorage key scan | Session registry key | Reliable, O(1) lookup, no key-namespace collisions |
| LRU eviction | Custom linked-list | Sort-splice on the registry array | Max 5 items; array sort is trivially fast |
| UUID | External `uuid` npm package | `crypto.randomUUID()` | Web API, zero bundle cost, already in use |

**Key insight:** The entire implementation avoids new runtime dependencies by using the Zustand 5 persist API already installed, native Web APIs, and the existing debounced storage adapter.

---

## Common Pitfalls

### Pitfall 1: Hydration Timing Race
**What goes wrong:** Store hydrates from the old single-session key before the tab identity is resolved, causing a flash of wrong state in the `?new=1` path.
**Why it happens:** Zustand `persist` calls `hydrate()` synchronously at module import time. If `tab-identity.ts` is not imported first, the store may read from whatever key was in `name` at creation time.
**How to avoid:** `tab-identity.ts` is imported first (module-level side effect order is deterministic in ES modules when imports are ordered); stores use `skipHydration: true` for the `?new=1` path. The module import order: `tab-identity.ts` → store files → App.tsx.
**Warning signs:** State from a previous session flashes briefly on `?new=1` load before being cleared.

### Pitfall 2: Legacy Migration Double-Read
**What goes wrong:** Both `input-store.ts` and `mapping-store.ts` detect legacy keys and try to migrate them independently, causing one to see empty data (the other already moved it).
**Why it happens:** Each store runs its own migration logic.
**How to avoid:** Migration is centralized entirely in `tab-identity.ts`'s `migrateToNamespacedKeys()` function, which runs once at module load before any store is created. Stores never touch legacy keys directly.
**Warning signs:** One of the two stores loads correctly and the other loads with empty state after migration.

### Pitfall 3: Registry `updatedAt` Jitter
**What goes wrong:** `updatedAt` is stamped at the moment of in-memory mutation rather than at the debounced write, making LRU eviction unreliable (a tab that was simply browsed but not written reflects inflated recency).
**Why it happens:** Calling `upsertRegistry` from store action handlers instead of the debounced write path.
**How to avoid:** Only `createDebouncedStorage`'s `setItem` callback (when the timer fires) calls `upsertRegistry`. `updatedAt = new Date().toISOString()` is stamped inside `setItem`, not inside store actions.
**Warning signs:** The LRU "most recent" is the tab you browsed last, not the one you actually wrote to.

### Pitfall 4: Eviction Deleting the Current Tab's Session
**What goes wrong:** LRU eviction removes the 6th oldest session — which is the current tab's session if the user opened 6 tabs — and then immediately writes fresh data back under the same key (a no-op since the key was just deleted).
**Why it happens:** Eviction fires on `setItem`; the current tab's `tabId` is in the registry and may be the least-recent.
**How to avoid:** `upsertRegistry()` upserts the current tab's record first (bumping `updatedAt` to now), then sorts and evicts. The current tab is always the most-recently-modified, so it's never in the evicted tail.
**Warning signs:** The current tab's session disappears from the registry after a write.

### Pitfall 5: Auto-Resume Adoptng a Dead TabId
**What goes wrong:** The auto-resume (D-07) adopts an old tabId as its own `sessionStorage` identity. If the user then clicks "New", the new tab gets a fresh ID, but the old session under the adopted tabId continues accumulating writes from the original tab.
**Why it happens:** Two tabs now share the same tabId after adoption.
**How to avoid:** Auto-resume assigns the adopted session data a **new** tabId (copy the data to a new key, delete the old one, write new tabId to sessionStorage). This way, the current tab owns a unique key.

Revised auto-resume action:
```typescript
// Correct auto-resume: give this tab a NEW identity that owns a copy of the most-recent data
const newTabId = crypto.randomUUID();
sessionStorage.setItem('folio-tab-id', newTabId);
const mappingData = localStorage.getItem(`folio-mapper-session-${mostRecent.tabId}-mapping`);
const inputData = localStorage.getItem(`folio-mapper-session-${mostRecent.tabId}-input`);
if (mappingData) localStorage.setItem(`folio-mapper-session-${newTabId}-mapping`, mappingData);
if (inputData) localStorage.setItem(`folio-mapper-session-${newTabId}-input`, inputData);
useMappingStore.persist.setOptions({ name: `folio-mapper-session-${newTabId}-mapping` });
useInputStore.persist.setOptions({ name: `folio-mapper-session-${newTabId}-input` });
// Then rehydrate from the new keys
```

### Pitfall 6: Mapping Screen "New" Still Guards on hasActiveSession
**What goes wrong:** The "New" button is invisible on the input screen because the current Header guard `hasActiveSession && onNewProject` hides it when no session is active.
**Why it happens:** The existing guard was correct for the old behavior (no need to start a new project if you don't have one). D-10 changes the button's meaning — it's now a "open blank tab" action, always available.
**How to avoid:** Remove the `hasActiveSession &&` guard from the "New" button in Header.tsx. The button is always rendered, regardless of session state.
**Warning signs:** The "New" button disappears after starting a fresh session.

---

## Code Examples

### Folio-Enrich Source Pattern (READ-ONLY reference, verbatim)

```javascript
// folio-enrich/frontend/index.html, lines 3007-3012
// Button that opens new tab
<button class="header-btn btn-primary"
  onclick="window.open(window.location.pathname+'?new=1','_blank')"
  title="Open new enrichment in a new tab">
  <svg ...>New</svg>
</button>

// folio-enrich/frontend/index.html, lines 3593-3595
// ?new=1 detection at page load
if (new URLSearchParams(window.location.search).has('new')) {
  sessionStorage.removeItem('folio_enrich_cache');
  history.replaceState(null, '', window.location.pathname);
  return false;
}
```

**Key difference from folio-mapper:** folio-enrich stores its entire state in `sessionStorage` (per-tab automatically, dies on browser close). folio-mapper needs `localStorage` for persistence across browser close (D-13). The `?new=1` pattern is identical; only the storage backend differs.

### Zustand skipHydration Pattern (Verified in 5.0.11)

```typescript
// Source: Verified in apps/web/node_modules/zustand/middleware.js
// setOptions merges, rehydrate() calls hydrate() manually

// Store creation — no auto-hydration
const useStore = create()(persist(
  stateCreator,
  { name: 'placeholder', skipHydration: true, storage: ... }
));

// At boot, set actual key and hydrate
useStore.persist.setOptions({ name: 'folio-mapper-session-abc123-mapping' });
useStore.persist.rehydrate(); // synchronous for localStorage
```

### Session Registry Metadata Shape

```typescript
// Metadata visible in the session picker (D-07b)
interface SessionRecord {
  tabId: string;          // key suffix
  updatedAt: string;      // ISO 8601 — drives LRU sort + D-14 "most recent"
  createdAt: string;      // ISO 8601 — displayed in picker
  totalNodes: number;     // for % progress display
  completed: number;
  skipped: number;
  sourceFile: string | null;  // display name (filename or null)
}
```

### Session Picker Integration (D-07b)

The existing `SessionRecoveryModal.tsx` is repurposed/extended into a `SessionPickerModal` that accepts an array of `SessionRecord[]` and exposes Resume / Start New / Delete per row.

```typescript
// Picker props (extends existing SessionRecoveryModal pattern)
interface SessionPickerModalProps {
  sessions: SessionRecord[];       // sorted by updatedAt desc
  currentTabId: string;            // highlight current session
  onResume: (tabId: string) => void;
  onDelete: (tabId: string) => void;
  onStartNew: () => void;          // opens a new tab
  onClose: () => void;
}
```

The picker entry point in the header is a small "recent sessions" clock icon button rendered next to the "New" button. On click, it reads the registry and opens the modal.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single shared localStorage session (folio-mapper current) | Per-tab namespaced keys + global registry | This phase | Multi-tab safe; no clobber |
| `persist` with static `name` at creation time | `skipHydration` + `setOptions` + `rehydrate()` for dynamic keys | Zustand 4+ (confirmed in 5.0.11) | Enables runtime-derived storage keys |
| Forced recovery modal gate on startup | Silent auto-resume (D-07) + on-demand picker (D-07b) | This phase | Zero-friction return to work |
| `beforeunload` warning | Removed (D-12) | This phase | Auto-save makes it redundant |

**Deprecated/outdated in this phase:**
- `NewProjectModal.tsx`: Entire component deleted (D-02). Call sites: `App.tsx` lines 720-727 (JSX), line 22 (import), line 25 (import from @folio-mapper/ui), plus `packages/ui/src/components/session/` file and its export from `packages/ui/src/index.ts`.
- `SessionRecoveryModal.tsx`: Gates app startup — repurposed into session picker, no longer rendered as forced overlay at mount.
- `handleNewProject`, `handleSaveAndNew`, `handleDiscardAndNew`, `handleCancelNewProject` in `useSession.ts`: Deleted (D-02).
- `beforeunload` handler in `useSession.ts` lines 103-112: Deleted (D-12).
- `showNewProjectModal` state and `newProjectPopover` prop in `App.tsx` and `Header.tsx`: Deleted (D-02).

---

## Removals Scope (D-02 / D-12) — Complete Call-Site Map

The planner needs exact file+line ranges to scope deletion tasks:

| Symbol | File | Lines | Deletion Action |
|--------|------|-------|-----------------|
| `handleNewProject` | `useSession.ts` | 207-209 | Delete function |
| `handleSaveAndNew` | `useSession.ts` | 211-215 | Delete function |
| `handleDiscardAndNew` | `useSession.ts` | 217-220 | Delete function |
| `handleCancelNewProject` | `useSession.ts` | 222-224 | Delete function |
| `showNewProjectModal` state | `useSession.ts` | 55 | Delete useState |
| `beforeunload` handler | `useSession.ts` | 103-112 | Delete useEffect |
| Return object props (4 handlers + `showNewProjectModal`) | `useSession.ts` | 248-252 | Delete from return |
| `NewProjectModal` JSX | `App.tsx` | 720-727 | Delete JSX block |
| `NewProjectModal` import | `App.tsx` | 25 | Delete from import list |
| `onNewProject` prop + handler wiring | `App.tsx` | 711-713 | Remove prop |
| `newProjectPopover` prop | `App.tsx` | 720-727 | Already deleted with JSX block |
| `NewProjectModal.tsx` | `packages/ui/src/components/session/` | entire file | Delete file |
| `NewProjectModal` export | `packages/ui/src/index.ts` | (find with grep) | Remove from barrel export |
| `hasActiveSession &&` guard on "New" button | `Header.tsx` | 95 | Remove conditional guard |
| `onNewProject` prop | `Header.tsx` | 11, 24 | Rename to `onNewTab` |
| `newProjectPopover` prop | `Header.tsx` | 22, 24 | Delete prop + slot |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in the target browser environments (Railway web app + potential Electron desktop) | Tab Identity Module | If Electron uses a Node context without Web Crypto API, fallback needed. In practice, modern Chromium-based Electron has it. [ASSUMED — not verified against Electron version] |
| A2 | `sessionStorage` behaves as expected in desktop Electron (each window = new session) | Tab Identity Module | Electron's sessionStorage semantics mirror browser tab semantics. [ASSUMED] |
| A3 | LRU cap of 5 is sufficient given folio-mapper session sizes (~2-5 MB each vs ~5-10 MB localStorage budget) | Session Registry | If sessions are larger than estimated, cap may need to be 3. [ASSUMED — size not measured in this research] |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (Three assumptions remain that are low-risk.)

---

## Open Questions (RESOLVED)

1. **Electron desktop session semantics**
   - What we know: The project has a desktop app (`apps/desktop/`) using Electron.
   - What's unclear: Whether Electron's `sessionStorage` per-window semantics match the browser per-tab semantics assumed by this design. `sessionStorage` in Electron's renderer process does survive window refresh but dies on window close, same as browsers.
   - Recommendation: Treat as matching; flag for smoke-test during verify-work.
   - RESOLVED: Assume Electron `sessionStorage` is browser-equivalent (per-window dies on window close); low risk, smoke-tested during verify-work.

2. **Session picker entry point in the header (D-07b)**
   - What we know: It should be "near the New button", accessible from all screens.
   - What's unclear: Whether to use a clock icon, "Recent" label, or dropdown trigger.
   - Recommendation: Claude's discretion — use a small clock icon button adjacent to "New", opening a modal (same overlay pattern as `SessionRecoveryModal`). Reuse `SessionRecoveryModal`'s modal shell.
   - RESOLVED: Picker entry point is a clock icon button positioned near the "New" button on all screens, opening the SessionPickerModal (reuses the SessionRecoveryModal shell).

3. **Session size estimation for LRU cap**
   - What we know: Cap is ~5 (D-09); sessions contain candidate lists, judge annotations.
   - What's unclear: Typical serialized size of a folio-mapper session with 50-200 items.
   - Recommendation: Implement cap at 5; add a `console.warn` when approaching quota (existing QuotaExceededError handler already in place). Adjust cap in a follow-up if needed.
   - RESOLVED: LRU cap of 5 (D-09) is the conservative choice; QuotaExceeded writes are swallowed with `console.warn` via the existing handler. Revisit the cap only if real session sizes exceed estimates.

---

## Environment Availability

Step 2.6: No new external CLI tools, databases, or services are required by this phase. All dependencies are browser Web APIs and installed npm packages.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `zustand/middleware` (persist) | Per-tab store namespacing | Yes | 5.0.11 | — |
| `crypto.randomUUID()` | Tab ID generation | Yes | Web API standard | — |
| `sessionStorage` | Tab identity pointer | Yes | Web API standard | — |
| `localStorage` | Session data + registry | Yes | Web API standard | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom environment) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @folio-mapper/web test --run` |
| Full suite command | `pnpm --filter @folio-mapper/web test --run && pnpm --filter @folio-mapper/ui test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `handleNewTab` calls `window.open` with `?new=1` and `_blank` | unit | `pnpm --filter @folio-mapper/web test --run -- tab-identity` | No — Wave 0 |
| D-05 | `?new=1` in URL → new tabId in sessionStorage → param stripped | unit | same | No — Wave 0 |
| D-06 | Legacy keys migrated to namespaced keys on first boot | unit | `pnpm --filter @folio-mapper/web test --run -- session-registry` | No — Wave 0 |
| D-07 | No identity + sessions in registry → auto-resume most-recent | unit | same | No — Wave 0 |
| D-08 | Existing sessionStorage tabId → stores hydrate from that tab's keys | unit | same | No — Wave 0 |
| D-09 | 6th session write evicts the LRU session's data from localStorage | unit | same | No — Wave 0 |
| D-12 | `beforeunload` handler no longer registered | unit | `pnpm --filter @folio-mapper/web test --run -- useSession` | Partially (useSession.ts tests do not currently exist) |
| D-14 | `updatedAt` in registry matches time of debounced write, not action call | unit | same | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @folio-mapper/web test --run`
- **Per wave merge:** `pnpm --filter @folio-mapper/web test --run && pnpm --filter @folio-mapper/ui test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/store/tab-identity.test.ts` — covers D-01, D-05, D-06, D-08 boot paths
- [ ] `apps/web/src/store/session-registry.test.ts` — covers D-07, D-09, D-14 registry behavior
- [ ] `apps/web/src/hooks/useSession.test.ts` — covers D-12 (beforeunload removed), boot resolver

---

## Security Domain

Security enforcement applies. This phase is pure client-side session management with no new network calls, API endpoints, or auth surfaces.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | yes (client-side only) | sessionStorage tab identity dies on tab close; no server session tokens |
| V4 Access Control | no | — |
| V5 Input Validation | yes (registry parsing) | `JSON.parse` wrapped in try/catch; validated before use |
| V6 Cryptography | no | `crypto.randomUUID()` is CSPRNG-backed; tab IDs are not secret |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session data accessible to other same-origin scripts | Information Disclosure | Already the case with existing localStorage; no change in posture |
| `?new=1` URL manipulation by third party | Spoofing | No server-side effect; only generates a fresh tab ID client-side. Benign: attacker can only cause a clean session in attacker's own tab. |
| Registry manipulation via browser devtools | Tampering | All registry data is UI metadata only; no auth or privilege. Tampered `tabId` would load wrong session data — user error only. |

No new security surface introduced by this phase.

---

## Sources

### Primary (HIGH confidence)
- `apps/web/node_modules/zustand/middleware.js` — Verified `setOptions`, `skipHydration`, `rehydrate()` APIs [VERIFIED: codebase grep]
- `/home/damienriehl/Coding Projects/folio-enrich/frontend/index.html` lines 3007-3012, 3593-3595 — Exact source pattern for `window.open(?new=1)` + detection + `history.replaceState` [VERIFIED: file read]
- `apps/web/src/store/session-storage.ts` — Existing debounced storage adapter (extension point) [VERIFIED: file read]
- `apps/web/src/store/input-store.ts` — Existing persist config with `name`, `partialize`, `merge` [VERIFIED: file read]
- `apps/web/src/store/mapping-store.ts` — Existing persist config [VERIFIED: file read]
- `apps/web/src/hooks/useSession.ts` — All symbols to be deleted or reworked [VERIFIED: file read]
- `packages/ui/src/components/layout/Header.tsx` — "New" button location, `hasActiveSession` guard, `newProjectPopover` slot [VERIFIED: file read]
- `packages/ui/src/components/layout/AppShell.tsx` — No `onNewProject` prop today; must be added [VERIFIED: file read]
- `apps/web/src/App.tsx` lines 698-727, 990-1109 — Screen routing, Header wiring, modal rendering [VERIFIED: file read]
- `packages/core/src/session/index.ts` — `SessionFile` schema [VERIFIED: file read]
- `apps/web/node_modules/zustand/package.json` — Zustand 5.0.11 [VERIFIED: file read]
- `apps/web/vitest.config.ts` — jsdom environment, `globals: true` [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- [Zustand persist middleware reference](https://github.com/SD11892/zustand/blob/main/docs/integrations/persisting-store-data.md) — `setOptions` API signature, `onRehydrateStorage` callback, `rehydrate()` type [CITED: docs mirror]
- [DeepWiki Zustand persist middleware](https://deepwiki.com/pmndrs/zustand/3.1-persist-middleware) — `skipHydration` + `setOptions` + `rehydrate()` pattern documented [CITED: community docs]
- [Zustand Discussion #474](https://github.com/pmndrs/zustand/discussions/474) — Dynamic persist names discussion [CITED: GitHub]

### Tertiary (LOW confidence)
- None — all critical claims verified against installed source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed node_modules source
- Architecture (tab-identity module, boot resolver, registry): HIGH — derived from verified Zustand APIs + folio-enrich source pattern + codebase read
- Pitfalls: HIGH — derived from understanding the Zustand hydration lifecycle and the specific ordering constraints
- Removals scope: HIGH — derived from file reads with line numbers

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (Zustand 5.x API is stable; browser Web APIs are stable)
