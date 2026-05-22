import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SessionRecord } from './session-registry';
// Note: renameSession is imported in tests below along with other named exports

// session-registry.ts operates over localStorage. We provide a Map-backed
// localStorage mock (same pattern as tab-identity.test.ts) since
// vitest's jsdom environment doesn't implement localStorage.clear().

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

// Helper to create a minimal valid SessionRecord
function makeRecord(tabId: string, updatedAt: string, opts: Partial<SessionRecord> = {}): SessionRecord {
  return {
    tabId,
    updatedAt,
    createdAt: opts.createdAt ?? '2026-01-01T00:00:00.000Z',
    totalNodes: opts.totalNodes ?? 10,
    completed: opts.completed ?? 5,
    skipped: opts.skipped ?? 0,
    sourceFile: opts.sourceFile ?? null,
    customName: opts.customName ?? null,
  };
}

describe('session-registry', () => {
  beforeEach(() => {
    localStorageMock = makeStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  describe('readRegistry', () => {
    it('returns empty array when no registry exists', async () => {
      const { readRegistry } = await import('./session-registry');
      expect(readRegistry()).toEqual([]);
    });

    it('returns empty array when registry key contains invalid JSON', async () => {
      const { readRegistry } = await import('./session-registry');
      localStorageMock.setItem('folio-mapper-session-registry', 'not-valid-json{{{');
      expect(readRegistry()).toEqual([]);
    });

    it('returns parsed records from registry key', async () => {
      const { readRegistry } = await import('./session-registry');
      const records = [makeRecord('tab-1', '2026-05-22T10:00:00.000Z')];
      localStorageMock.setItem('folio-mapper-session-registry', JSON.stringify(records));
      expect(readRegistry()).toEqual(records);
    });
  });

  describe('upsertRegistry', () => {
    it('D-14: adds a record and readRegistry returns it sorted most-recent first', async () => {
      const { readRegistry, upsertRegistry } = await import('./session-registry');

      const older = makeRecord('tab-old', '2026-05-20T10:00:00.000Z');
      const newer = makeRecord('tab-new', '2026-05-22T10:00:00.000Z');

      upsertRegistry(older);
      upsertRegistry(newer);

      const result = readRegistry();
      expect(result[0].tabId).toBe('tab-new'); // most recent is rank 0
      expect(result[1].tabId).toBe('tab-old');
    });

    it('updates existing record by tabId (upsert, not duplicate)', async () => {
      const { readRegistry, upsertRegistry } = await import('./session-registry');

      const record = makeRecord('tab-1', '2026-05-20T10:00:00.000Z');
      upsertRegistry(record);

      const updated = { ...record, updatedAt: '2026-05-22T10:00:00.000Z', completed: 8 };
      upsertRegistry(updated);

      const result = readRegistry();
      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(8);
      expect(result[0].updatedAt).toBe('2026-05-22T10:00:00.000Z');
    });

    it('D-09: upserting 6 distinct tabIds keeps only 5 (LRU eviction)', async () => {
      const { readRegistry, upsertRegistry } = await import('./session-registry');

      // Insert 5 sessions with ascending updatedAt
      for (let i = 1; i <= 5; i++) {
        upsertRegistry(makeRecord(`tab-${i}`, `2026-05-${String(i).padStart(2, '0')}T10:00:00.000Z`));
      }

      // Insert the 6th — this is the current tab, so it's the most recent
      upsertRegistry(makeRecord('tab-6', '2026-05-22T12:00:00.000Z'));

      const result = readRegistry();
      expect(result).toHaveLength(5); // capped at MAX_SESSIONS
    });

    it('D-09: evicted session data keys are removed from localStorage', async () => {
      const { upsertRegistry } = await import('./session-registry');

      // tab-1 with the oldest updatedAt will be evicted when tab-6 is added
      const evictedTabId = 'tab-evict';
      localStorageMock.setItem(`folio-mapper-session-${evictedTabId}-mapping`, '{"state":{}}');
      localStorageMock.setItem(`folio-mapper-session-${evictedTabId}-input`, '{"state":{}}');

      upsertRegistry(makeRecord(evictedTabId, '2026-05-01T00:00:00.000Z'));

      // Add 5 more with more recent timestamps — evictedTabId gets pushed out
      for (let i = 1; i <= 5; i++) {
        upsertRegistry(makeRecord(`tab-keep-${i}`, `2026-05-${String(i + 10).padStart(2, '0')}T10:00:00.000Z`));
      }

      // Evicted tab's data keys must be removed
      expect(localStorageMock.getItem(`folio-mapper-session-${evictedTabId}-mapping`)).toBeNull();
      expect(localStorageMock.getItem(`folio-mapper-session-${evictedTabId}-input`)).toBeNull();
    });

    it('D-09: current tab (most recent updatedAt) is NEVER evicted', async () => {
      const { readRegistry, upsertRegistry } = await import('./session-registry');

      // Fill the registry with 5 sessions
      for (let i = 1; i <= 5; i++) {
        upsertRegistry(makeRecord(`tab-old-${i}`, `2026-05-${String(i).padStart(2, '0')}T10:00:00.000Z`));
      }

      // "Current tab" — its updatedAt is now, so it's always rank 0 and never evicted
      const currentTabId = 'tab-current';
      upsertRegistry(makeRecord(currentTabId, '2026-05-22T23:59:59.999Z'));

      const result = readRegistry();
      expect(result).toHaveLength(5);
      expect(result[0].tabId).toBe(currentTabId); // current tab is rank 0
      // Current tab must not be evicted
      const tabIds = result.map((r) => r.tabId);
      expect(tabIds).toContain(currentTabId);
    });

    it('D-07-support: readRegistry sorts by updatedAt desc, most-recent is rank 0', async () => {
      const { readRegistry, upsertRegistry } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-b', '2026-05-10T10:00:00.000Z'));
      upsertRegistry(makeRecord('tab-c', '2026-05-15T10:00:00.000Z'));
      upsertRegistry(makeRecord('tab-a', '2026-05-22T10:00:00.000Z'));

      const result = readRegistry();
      expect(result[0].tabId).toBe('tab-a'); // most recently modified
      expect(result[1].tabId).toBe('tab-c');
      expect(result[2].tabId).toBe('tab-b');
    });
  });

  describe('deleteFromRegistry', () => {
    it('removes the record from the registry', async () => {
      const { readRegistry, upsertRegistry, deleteFromRegistry } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-keep', '2026-05-22T10:00:00.000Z'));
      upsertRegistry(makeRecord('tab-delete', '2026-05-21T10:00:00.000Z'));

      deleteFromRegistry('tab-delete');

      const result = readRegistry();
      expect(result).toHaveLength(1);
      expect(result[0].tabId).toBe('tab-keep');
    });

    it('removes the two namespaced data keys for the deleted tabId', async () => {
      const { upsertRegistry, deleteFromRegistry } = await import('./session-registry');

      const tabId = 'tab-to-delete';
      localStorageMock.setItem(`folio-mapper-session-${tabId}-mapping`, '{"state":{}}');
      localStorageMock.setItem(`folio-mapper-session-${tabId}-input`, '{"state":{}}');
      upsertRegistry(makeRecord(tabId, '2026-05-22T10:00:00.000Z'));

      deleteFromRegistry(tabId);

      expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-mapping`)).toBeNull();
      expect(localStorageMock.getItem(`folio-mapper-session-${tabId}-input`)).toBeNull();
    });

    it('does nothing if tabId is not in registry (idempotent)', async () => {
      const { readRegistry, upsertRegistry, deleteFromRegistry } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-keep', '2026-05-22T10:00:00.000Z'));
      deleteFromRegistry('tab-nonexistent');

      expect(readRegistry()).toHaveLength(1);
    });
  });

  describe('renameSession', () => {
    it('sets a trimmed custom name on the matching record', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z'));
      renameSession('tab-1', '  My Custom Name  ');

      const result = readRegistry();
      expect(result.find((r) => r.tabId === 'tab-1')?.customName).toBe('My Custom Name');
    });

    it('clears customName to null on empty string input', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z', { customName: 'Old Name' }));
      renameSession('tab-1', '');

      const result = readRegistry();
      expect(result.find((r) => r.tabId === 'tab-1')?.customName).toBeNull();
    });

    it('clears customName to null on whitespace-only input', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z', { customName: 'Old Name' }));
      renameSession('tab-1', '   ');

      const result = readRegistry();
      expect(result.find((r) => r.tabId === 'tab-1')?.customName).toBeNull();
    });

    it('is a no-op when the tabId is not in the registry', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z'));
      renameSession('tab-unknown', 'Should Do Nothing');

      const result = readRegistry();
      expect(result).toHaveLength(1);
      expect(result[0].customName).toBeNull();
    });

    it('does NOT change updatedAt (renaming must not bump session rank)', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      const originalUpdatedAt = '2026-05-20T10:00:00.000Z';
      upsertRegistry(makeRecord('tab-1', originalUpdatedAt));
      renameSession('tab-1', 'New Name');

      const result = readRegistry();
      expect(result.find((r) => r.tabId === 'tab-1')?.updatedAt).toBe(originalUpdatedAt);
    });

    it('onWrite-preservation: upsertRegistry with customName from existing record retains the custom name', async () => {
      const { readRegistry, upsertRegistry, renameSession } = await import('./session-registry');

      // Simulate user sets a custom name
      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z'));
      renameSession('tab-1', 'My Project');

      // Simulate a subsequent onWrite: reads existing record, carries customName
      const existing = readRegistry().find((r) => r.tabId === 'tab-1');
      const updatedRecord = makeRecord('tab-1', '2026-05-22T11:00:00.000Z', {
        customName: existing?.customName ?? null,
      });
      upsertRegistry(updatedRecord);

      const result = readRegistry();
      expect(result.find((r) => r.tabId === 'tab-1')?.customName).toBe('My Project');
    });
  });

  describe('constants', () => {
    it('does NOT touch folio-mapper-llm key', async () => {
      const { upsertRegistry, deleteFromRegistry } = await import('./session-registry');

      localStorageMock.setItem('folio-mapper-llm', '{"provider":"openai"}');
      upsertRegistry(makeRecord('tab-1', '2026-05-22T10:00:00.000Z'));
      deleteFromRegistry('tab-1');

      // LLM key must be untouched
      expect(localStorageMock.getItem('folio-mapper-llm')).toBe('{"provider":"openai"}');
    });
  });
});
