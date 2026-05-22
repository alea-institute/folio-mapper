// Tab identity resolver — synchronous module-level side effect.
// Runs once at import time, before any Zustand store is created.
// No framework imports — browser globals only (URLSearchParams, sessionStorage,
// localStorage, crypto, history).

const TABID_SESSIONKEY = 'folio-tab-id';
const LEGACY_MAPPING_KEY = 'folio-mapper-session-mapping';
const LEGACY_INPUT_KEY = 'folio-mapper-session-input';

/**
 * Copy legacy single-session keys to namespaced per-tab keys, then
 * remove the legacy keys. Centralized here (Pitfall 2 — never in stores).
 */
function migrateToNamespacedKeys(tabId: string): void {
  const legacyMapping = localStorage.getItem(LEGACY_MAPPING_KEY);
  if (legacyMapping !== null) {
    try {
      localStorage.setItem(`folio-mapper-session-${tabId}-mapping`, legacyMapping);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[tab-identity] localStorage quota exceeded, skipping migration write for mapping');
      } else {
        throw e;
      }
    }
    localStorage.removeItem(LEGACY_MAPPING_KEY);
  }

  const legacyInput = localStorage.getItem(LEGACY_INPUT_KEY);
  if (legacyInput !== null) {
    try {
      localStorage.setItem(`folio-mapper-session-${tabId}-input`, legacyInput);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[tab-identity] localStorage quota exceeded, skipping migration write for input');
      } else {
        throw e;
      }
    }
    localStorage.removeItem(LEGACY_INPUT_KEY);
  }
}

/**
 * Resolve the tab identity synchronously at module load.
 *
 * Branch order (matches RESEARCH.md Pattern 1 exactly):
 *   1. D-05: ?new=1 in URL → generate fresh tabId, strip param
 *   2. D-08: existing sessionStorage identity → reuse (refresh path)
 *   3. D-06: legacy single-session data → migrate to namespaced keys
 *   4. D-07 fallback: no identity, no data → boot resolver handles auto-resume
 */
export function resolveTabIdentity(): { tabId: string; isNewTab: boolean; hasIdentity: boolean } {
  // D-01/D-05: ?new=1 detection (folio-enrich pattern)
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) {
    const newId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, newId);
    // Security: replaceState receives window.location.pathname ONLY — never
    // the query string or any user-controlled value (T-03-01 open-redirect guard).
    history.replaceState(null, '', window.location.pathname);
    return { tabId: newId, isNewTab: true, hasIdentity: true };
  }

  // D-08: Refresh path — reuse existing tab identity from sessionStorage
  const existing = sessionStorage.getItem(TABID_SESSIONKEY);
  if (existing) {
    return { tabId: existing, isNewTab: false, hasIdentity: true };
  }

  // D-06: Legacy migration — single-session data exists without a tab identity.
  // Adopt it as the most-recent session by generating an ID and migrating keys.
  const hasLegacyMapping = localStorage.getItem(LEGACY_MAPPING_KEY) !== null;
  const hasLegacyInput = localStorage.getItem(LEGACY_INPUT_KEY) !== null;
  if (hasLegacyMapping || hasLegacyInput) {
    const migratedId = crypto.randomUUID();
    sessionStorage.setItem(TABID_SESSIONKEY, migratedId);
    migrateToNamespacedKeys(migratedId);
    return { tabId: migratedId, isNewTab: false, hasIdentity: true };
  }

  // D-07: No identity, no legacy data — boot resolver will handle auto-resume.
  return { tabId: '', isNewTab: false, hasIdentity: false };
}

/** Tab identity resolved synchronously at module load. */
export const tabIdentity = resolveTabIdentity();

/** Per-tab namespaced localStorage key for mapping store data. */
export const MAPPING_KEY: string = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-mapping`
  : 'folio-mapper-session-placeholder-mapping';

/** Per-tab namespaced localStorage key for input store data. */
export const INPUT_KEY: string = tabIdentity.tabId
  ? `folio-mapper-session-${tabIdentity.tabId}-input`
  : 'folio-mapper-session-placeholder-input';
