import { describe, it, expect, beforeEach, vi } from 'vitest';

// tab-identity.ts runs synchronously at module load, so we must use
// vi.resetModules() + dynamic import() to re-run it per test.
// beforeEach resets all storage and stubs so each test starts clean.

// localStorage mock — vitest's jsdom implementation doesn't support .clear()
// so we provide a Map-backed mock via vi.stubGlobal.
function makeStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string): string | null { return store.get(key) ?? null; },
    setItem(key: string, value: string): void { store.set(key, value); },
    removeItem(key: string): void { store.delete(key); },
    clear(): void { store.clear(); },
  } as Storage;
}

let localStorageMock: Storage;
let sessionStorageMock: Storage;

describe('tab-identity', () => {
  beforeEach(() => {
    localStorageMock = makeStorageMock();
    sessionStorageMock = makeStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    vi.resetModules();
    // Reset window.location to empty search by default
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '', pathname: '/test' },
    });
    // Stub history.replaceState
    vi.stubGlobal('history', { replaceState: vi.fn() });
    // Stub crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('test-uuid-1234-5678-9012-abcdef123456'),
    });
  });

  it('D-05: ?new=1 in URL → generates new tabId, stores in sessionStorage, isNewTab true', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '?new=1', pathname: '/test' },
    });

    const { tabIdentity } = await import('./tab-identity');

    expect(tabIdentity.tabId).toBe('test-uuid-1234-5678-9012-abcdef123456');
    expect(tabIdentity.isNewTab).toBe(true);
    expect(tabIdentity.hasIdentity).toBe(true);
    expect(sessionStorageMock.getItem('folio-tab-id')).toBe('test-uuid-1234-5678-9012-abcdef123456');
    // history.replaceState should have been called with pathname only
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/test');
  });

  it('D-05: history.replaceState uses window.location.pathname only (not search/query)', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { search: '?new=1', pathname: '/app/path' },
    });

    await import('./tab-identity');

    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/app/path');
    // Must NOT include search params
    const call = (history.replaceState as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[2]).not.toContain('?');
    expect(call[2]).not.toContain('new');
  });

  it('D-08: existing folio-tab-id in sessionStorage → reuses it, isNewTab false, hasIdentity true', async () => {
    sessionStorageMock.setItem('folio-tab-id', 'existing-tab-id-abc');

    const { tabIdentity } = await import('./tab-identity');

    expect(tabIdentity.tabId).toBe('existing-tab-id-abc');
    expect(tabIdentity.isNewTab).toBe(false);
    expect(tabIdentity.hasIdentity).toBe(true);
    // Should NOT generate a new UUID
    expect(crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('D-06: legacy mapping key in localStorage → migrated to namespaced key, legacy key removed', async () => {
    const legacyData = '{"state":{"items":["test"]}}';
    localStorageMock.setItem('folio-mapper-session-mapping', legacyData);

    const { tabIdentity } = await import('./tab-identity');

    expect(tabIdentity.isNewTab).toBe(false);
    expect(tabIdentity.hasIdentity).toBe(true);
    const tabId = tabIdentity.tabId;
    expect(tabId).toBeTruthy();

    // Legacy key must be removed
    expect(localStorageMock.getItem('folio-mapper-session-mapping')).toBeNull();

    // Data must be at namespaced key
    expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-mapping`)).toBe(legacyData);
  });

  it('D-06: legacy input key in localStorage → migrated to namespaced key, no data loss', async () => {
    const legacyData = '{"state":{"screen":"input"}}';
    localStorageMock.setItem('folio-mapper-session-input', legacyData);

    const { tabIdentity } = await import('./tab-identity');

    const tabId = tabIdentity.tabId;
    expect(tabId).toBeTruthy();

    // Legacy key must be removed
    expect(localStorageMock.getItem('folio-mapper-session-input')).toBeNull();

    // Data must be at namespaced key
    expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-input`)).toBe(legacyData);
  });

  it('D-06: both legacy keys migrated — neither is lost', async () => {
    const legacyMapping = '{"state":{"mappings":{}}}';
    const legacyInput = '{"state":{"screen":"confirming"}}';
    localStorageMock.setItem('folio-mapper-session-mapping', legacyMapping);
    localStorageMock.setItem('folio-mapper-session-input', legacyInput);

    const { tabIdentity } = await import('./tab-identity');

    const tabId = tabIdentity.tabId;
    expect(localStorageMock.getItem('folio-mapper-session-mapping')).toBeNull();
    expect(localStorageMock.getItem('folio-mapper-session-input')).toBeNull();
    expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-mapping`)).toBe(legacyMapping);
    expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-input`)).toBe(legacyInput);
  });

  it('D-07 fallback: no search, no sessionStorage, no legacy → tabId empty, hasIdentity false', async () => {
    // Nothing preset — clean slate

    const { tabIdentity } = await import('./tab-identity');

    expect(tabIdentity.tabId).toBe('');
    expect(tabIdentity.isNewTab).toBe(false);
    expect(tabIdentity.hasIdentity).toBe(false);
  });

  it('exports MAPPING_KEY and INPUT_KEY with correct namespaced format', async () => {
    sessionStorageMock.setItem('folio-tab-id', 'known-tab-id');

    const { MAPPING_KEY, INPUT_KEY } = await import('./tab-identity');

    expect(MAPPING_KEY).toBe('folio-mapper-session-known-tab-id-mapping');
    expect(INPUT_KEY).toBe('folio-mapper-session-known-tab-id-input');
  });

  it('MAPPING_KEY and INPUT_KEY use placeholder when tabId is empty', async () => {
    // No session, no legacy data → tabId = ''
    const { MAPPING_KEY, INPUT_KEY } = await import('./tab-identity');

    expect(MAPPING_KEY).toContain('placeholder');
    expect(INPUT_KEY).toContain('placeholder');
  });

  it('exports resolveTabIdentity function and tabIdentity constant', async () => {
    const mod = await import('./tab-identity');
    expect(mod.resolveTabIdentity).toBeTypeOf('function');
    expect(mod.tabIdentity).toBeDefined();
    expect(mod.tabIdentity).toHaveProperty('tabId');
    expect(mod.tabIdentity).toHaveProperty('isNewTab');
    expect(mod.tabIdentity).toHaveProperty('hasIdentity');
  });

  // Key-construction helpers (IN-03) — the single source of truth that the
  // CR-01/CR-02 registry-pointer fix derives the active tabId from.
  describe('key helpers', () => {
    it('mappingKeyFor / inputKeyFor build the namespaced keys', async () => {
      const { mappingKeyFor, inputKeyFor } = await import('./tab-identity');
      expect(mappingKeyFor('abc-123')).toBe('folio-mapper-session-abc-123-mapping');
      expect(inputKeyFor('abc-123')).toBe('folio-mapper-session-abc-123-input');
    });

    it('tabIdFromMappingKey round-trips a real tabId (incl. UUID hyphens)', async () => {
      const { mappingKeyFor, tabIdFromMappingKey } = await import('./tab-identity');
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(tabIdFromMappingKey(mappingKeyFor(uuid))).toBe(uuid);
    });

    it('tabIdFromMappingKey extracts the placeholder sentinel', async () => {
      const { MAPPING_KEY, tabIdFromMappingKey, PLACEHOLDER_TAB_ID } = await import('./tab-identity');
      // No identity in this test → MAPPING_KEY is the placeholder key.
      expect(tabIdFromMappingKey(MAPPING_KEY)).toBe(PLACEHOLDER_TAB_ID);
    });

    it('tabIdFromMappingKey returns null for non-mapping keys', async () => {
      const { tabIdFromMappingKey } = await import('./tab-identity');
      expect(tabIdFromMappingKey('folio-mapper-session-abc-input')).toBeNull();
      expect(tabIdFromMappingKey('some-other-key')).toBeNull();
    });
  });
});
