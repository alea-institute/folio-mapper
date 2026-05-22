import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// NOTE: useSession.ts imports from tab-identity.ts at module load time.
// tab-identity.ts runs resolveTabIdentity() synchronously, reading from
// sessionStorage/localStorage. We use vi.resetModules() + dynamic import()
// per test to control which tab-identity state the hook sees.
//
// The global Map-backed storage mock in test-setup.ts ensures localStorage
// and sessionStorage are always available before any module loads.

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

describe('useSession', () => {
  let localStorageMock: Storage;
  let sessionStorageMock: Storage;

  beforeEach(() => {
    localStorageMock = makeStorageMock();
    sessionStorageMock = makeStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('new-uuid-0001-0000-0000-000000000000'),
    });
    // Reset modules so tab-identity.ts re-runs with current storage state
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // D-12: No beforeunload listener registered by useSession
  // ─────────────────────────────────────────────────────────────────────────
  it('D-12: does not register a beforeunload listener', async () => {
    // Arrange: set up a hasIdentity tab (direct-hydration path) so we're not
    // in the auto-resume path either; keeps the test focused on D-12.
    sessionStorageMock.setItem('folio-tab-id', 'test-tab-id-d12');

    const addEventSpy = vi.spyOn(window, 'addEventListener');

    const { useSession } = await import('./useSession');

    act(() => {
      renderHook(() => useSession());
    });

    // Assert: addEventListener was never called with 'beforeunload'
    const beforeunloadCalls = addEventSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload',
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // D-01/D-03: handleNewTab opens a new tab with ?new=1 — no confirmation
  // ─────────────────────────────────────────────────────────────────────────
  it('D-01/D-03: handleNewTab calls window.open with ?new=1 and _blank', async () => {
    // Arrange: hasIdentity tab so no auto-resume side effects
    sessionStorageMock.setItem('folio-tab-id', 'test-tab-id-d01');

    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    // Stub window.open specifically
    Object.defineProperty(window, 'open', { value: openSpy, writable: true, configurable: true });

    // Stub window.location for consistent pathname
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/app', search: '', href: 'http://localhost/app' },
    });

    const confirmSpy = vi.fn();
    vi.stubGlobal('confirm', confirmSpy);

    const { useSession } = await import('./useSession');

    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.handleNewTab();
    });

    // Assert: window.open called once with pathname+'?new=1' and '_blank'
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toBe('/app?new=1');
    expect(target).toBe('_blank');

    // Assert: no confirmation prompt was shown (D-03: instant, no confirm)
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // D-07 / Pitfall 5: auto-resume copies most-recent session under a NEW tabId
  // ─────────────────────────────────────────────────────────────────────────
  it('D-07/Pitfall5: auto-resume copies most-recent session data under a new tabId', async () => {
    // Arrange: no tab identity in sessionStorage (simulates fresh browser tab)
    // but there IS a session in the registry + corresponding localStorage data.
    const EXISTING_TAB_ID = 'existing-tab-aaaa-bbbb-cccc-dddddddddddd';
    const mappingKey = `folio-mapper-session-${EXISTING_TAB_ID}-mapping`;
    const inputKey = `folio-mapper-session-${EXISTING_TAB_ID}-input`;
    const registryKey = 'folio-mapper-session-registry';

    // Seed existing session data
    localStorageMock.setItem(mappingKey, JSON.stringify({ state: { mappingResponse: { items: [] } } }));
    localStorageMock.setItem(inputKey, JSON.stringify({ state: { screen: 'mapping', textInput: 'Test' } }));

    // Seed registry with one record
    const sessionRecord = {
      tabId: EXISTING_TAB_ID,
      updatedAt: '2026-05-22T10:00:00.000Z',
      createdAt: '2026-05-22T09:00:00.000Z',
      totalNodes: 5,
      completed: 3,
      skipped: 1,
      sourceFile: 'test.csv',
    };
    localStorageMock.setItem(registryKey, JSON.stringify([sessionRecord]));

    // Deterministic UUID for the new tabId
    const NEW_TAB_ID = 'new-uuid-0001-0000-0000-000000000000';
    (crypto.randomUUID as ReturnType<typeof vi.fn>).mockReturnValue(NEW_TAB_ID);

    const { useSession } = await import('./useSession');

    renderHook(() => useSession());

    // Wait for effects (onFinishHydration fires synchronously, effect runs async)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Assert: new tabId written to sessionStorage (Pitfall 5 — new tab owns new key)
    expect(sessionStorageMock.getItem('folio-tab-id')).toBe(NEW_TAB_ID);

    // Assert: original keys still present (data was COPIED, not moved)
    expect(localStorageMock.getItem(mappingKey)).not.toBeNull();
    expect(localStorageMock.getItem(inputKey)).not.toBeNull();

    // Assert: new namespaced keys populated with the copied data
    const newMappingKey = `folio-mapper-session-${NEW_TAB_ID}-mapping`;
    const newInputKey = `folio-mapper-session-${NEW_TAB_ID}-input`;
    expect(localStorageMock.getItem(newMappingKey)).toBe(localStorageMock.getItem(mappingKey));
    expect(localStorageMock.getItem(newInputKey)).toBe(localStorageMock.getItem(inputKey));
  });
});
