import '@testing-library/jest-dom/vitest';

// Provide a Map-backed localStorage/sessionStorage mock for ALL test files.
// Vitest's jsdom environment provides a partial localStorage implementation,
// but does not fully initialize it in all worker contexts (manifests as
// "localStorage.getItem is not a function" when modules with top-level storage
// access are imported transitively). This global Map-backed mock ensures all
// storage APIs are available at module-load time for every test file.
//
// Note: tab-identity.ts (Wave 1) runs resolveTabIdentity() synchronously at
// module load. Any test file that imports input-store.ts or mapping-store.ts
// now transitively imports tab-identity.ts and requires this mock to be
// in place before the import graph resolves.
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

// Unconditionally replace storage globals with Map-backed implementations.
// Tests that need specific storage state (tab-identity.test.ts,
// session-registry.test.ts) already use vi.stubGlobal + vi.resetModules()
// per-test and are unaffected by this global default.
Object.defineProperty(globalThis, 'localStorage', {
  value: makeStorageMock(),
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: makeStorageMock(),
  writable: true,
  configurable: true,
});
