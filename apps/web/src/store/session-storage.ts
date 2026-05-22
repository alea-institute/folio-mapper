import type { StateStorage } from 'zustand/middleware';

const DEBOUNCE_MS = 5000;

/**
 * A localStorage adapter that debounces writes to avoid excessive I/O
 * on rapid state changes (e.g., keystroke-level updates to selections).
 *
 * @param opts.onWrite - Optional callback fired AFTER localStorage.setItem succeeds,
 *   with the key name as argument. Used by the session registry to bump updatedAt
 *   at debounced-write time (Pitfall 3: never on in-memory store mutations).
 *   Existing call sites (llm-store.ts) pass no args and remain unaffected.
 */
export function createDebouncedStorage(opts?: { onWrite?: (name: string) => void }): StateStorage {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastWritten = new Map<string, string>();

  return {
    getItem(name: string): string | null {
      return localStorage.getItem(name);
    },

    setItem(name: string, value: string): void {
      // Skip if identical to last write
      if (lastWritten.get(name) === value) return;

      // Clear any pending timer for this key
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);

      timers.set(
        name,
        setTimeout(() => {
          try {
            localStorage.setItem(name, value);
            lastWritten.set(name, value);
            // Fire onWrite AFTER successful setItem (Pitfall 3 guard: updatedAt
            // is tied to "last persisted" time, not "last in-memory mutation").
            opts?.onWrite?.(name);
          } catch (e) {
            // QuotaExceededError — silently ignore
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
              console.warn('[session-storage] localStorage quota exceeded, skipping write for', name);
            } else {
              throw e;
            }
          }
          timers.delete(name);
        }, DEBOUNCE_MS),
      );
    },

    removeItem(name: string): void {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      lastWritten.delete(name);
      localStorage.removeItem(name);
    },
  };
}
