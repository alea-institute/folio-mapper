import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './demo-store';

describe('demo-store', () => {
  beforeEach(() => {
    useDemoStore.setState({ exemplarMode: 'lean' });
  });

  it('defaults to lean', () => {
    expect(useDemoStore.getState().exemplarMode).toBe('lean');
  });

  it('toggleExemplarMode flips lean to demo and back', () => {
    const { toggleExemplarMode } = useDemoStore.getState();

    toggleExemplarMode();
    expect(useDemoStore.getState().exemplarMode).toBe('demo');

    toggleExemplarMode();
    expect(useDemoStore.getState().exemplarMode).toBe('lean');
  });

  it('setExemplarMode sets explicitly', () => {
    const { setExemplarMode } = useDemoStore.getState();

    setExemplarMode('demo');
    expect(useDemoStore.getState().exemplarMode).toBe('demo');

    setExemplarMode('lean');
    expect(useDemoStore.getState().exemplarMode).toBe('lean');

    // Idempotent: setting same value should not error
    setExemplarMode('lean');
    expect(useDemoStore.getState().exemplarMode).toBe('lean');
  });

  it('does NOT write to localStorage when toggled', () => {
    const before = new Set(Object.keys(localStorage));

    useDemoStore.getState().toggleExemplarMode();
    useDemoStore.getState().setExemplarMode('lean');
    useDemoStore.getState().toggleExemplarMode();

    const after = Object.keys(localStorage);

    // No new key matching /demo/i should have appeared after toggling.
    const newDemoKeys = after.filter(
      (key) => !before.has(key) && /demo/i.test(key),
    );
    expect(newDemoKeys).toEqual([]);
  });
});
