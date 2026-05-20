import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './demo-store';

describe('demo-store', () => {
  beforeEach(() => {
    useDemoStore.setState({ exemplarMode: 'lean', stalePresetWarning: null });
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

  it('setStalePresetWarning stores the warning', () => {
    useDemoStore.getState().setStalePresetWarning({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: '0.2.0',
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: '0.2.1',
    });
    expect(useDemoStore.getState().stalePresetWarning).toEqual({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: '0.2.0',
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: '0.2.1',
    });
  });

  it('dismissStalePresetWarning clears it', () => {
    useDemoStore.getState().setStalePresetWarning({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: null,
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: null,
    });
    useDemoStore.getState().dismissStalePresetWarning();
    expect(useDemoStore.getState().stalePresetWarning).toBeNull();
  });

  it('toggling back to lean clears any warning', () => {
    useDemoStore.setState({ exemplarMode: 'demo' });
    useDemoStore.getState().setStalePresetWarning({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: null,
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: null,
    });
    useDemoStore.getState().toggleExemplarMode();
    expect(useDemoStore.getState().exemplarMode).toBe('lean');
    expect(useDemoStore.getState().stalePresetWarning).toBeNull();
  });

  it('setExemplarMode lean clears any warning', () => {
    useDemoStore.setState({ exemplarMode: 'demo' });
    useDemoStore.getState().setStalePresetWarning({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: null,
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: null,
    });
    useDemoStore.getState().setExemplarMode('lean');
    expect(useDemoStore.getState().stalePresetWarning).toBeNull();
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
