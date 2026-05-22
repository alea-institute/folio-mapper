// Session registry — pure named functions over localStorage, no framework imports.
// Maintains an index of all saved per-tab sessions, enforces LRU cap (D-09),
// and stores only UI metadata (no secrets, no auth tokens) per the threat model.

export interface SessionRecord {
  tabId: string;
  updatedAt: string;     // ISO 8601; bumped only inside debounced setItem, never in store actions
  createdAt: string;     // ISO 8601; set once on first upsert
  totalNodes: number;    // From mapping state (for % progress display)
  completed: number;     // Completed node count
  skipped: number;       // Skipped node count
  sourceFile: string | null;  // Display name (filename or null)
}

export const REGISTRY_KEY = 'folio-mapper-session-registry';
export const MAX_SESSIONS = 5;

/**
 * Read and parse the session registry from localStorage.
 * Returns [] on missing key or JSON parse failure (JSON.parse safety pattern).
 */
export function readRegistry(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    // WR-02: validate shape — a corrupted/non-array value (object, number, or a
    // truncated write) must not crash downstream .findIndex / .sort / registry[0].
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is SessionRecord => r != null && typeof r.tabId === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Upsert a session record into the registry.
 *
 * D-14: The supplied record already has updatedAt stamped by the caller (the
 *       debounced write path stamps it at write time — Pitfall 3 guard).
 * D-09: After upsert, sort descending by updatedAt and splice off everything
 *       past MAX_SESSIONS. Evicted records have their two namespaced data keys
 *       removed from localStorage.
 *
 * CRITICAL (Pitfall 4): The supplied record's updatedAt is "now" (from the
 * debounced write), so the current tab is always rank 0 and is NEVER evicted.
 */
export function upsertRegistry(record: SessionRecord): void {
  const registry = readRegistry();

  // Replace existing record for this tabId, or append if new
  const idx = registry.findIndex((r) => r.tabId === record.tabId);
  if (idx >= 0) {
    registry[idx] = record;
  } else {
    registry.push(record);
  }

  // Sort descending by updatedAt — most-recently-modified is rank 0
  registry.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // Enforce LRU cap: evict records past MAX_SESSIONS
  const evicted = registry.splice(MAX_SESSIONS);
  for (const e of evicted) {
    localStorage.removeItem(`folio-mapper-session-${e.tabId}-mapping`);
    localStorage.removeItem(`folio-mapper-session-${e.tabId}-input`);
  }

  // Persist the trimmed array with QuotaExceeded guard (Pitfall 3 / session-storage.ts pattern)
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[session-registry] localStorage quota exceeded, skipping registry write');
    } else {
      throw e;
    }
  }
}

/**
 * Remove a session record from the registry and delete its two namespaced
 * data keys from localStorage.
 */
export function deleteFromRegistry(tabId: string): void {
  const registry = readRegistry().filter((r) => r.tabId !== tabId);
  // Remove the evicted session's data keys
  localStorage.removeItem(`folio-mapper-session-${tabId}-mapping`);
  localStorage.removeItem(`folio-mapper-session-${tabId}-input`);
  // Write updated registry back (no QuotaExceeded risk on delete — we're shrinking)
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[session-registry] localStorage quota exceeded, skipping registry write on delete');
    } else {
      throw e;
    }
  }
}
