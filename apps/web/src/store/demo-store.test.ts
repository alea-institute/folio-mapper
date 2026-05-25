import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './demo-store';

describe('demo-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useDemoStore.setState({ exemplarMode: 'lean', stalePresetWarning: null, isDemoSession: false });
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

  it('persists exemplarMode to localStorage so demo mode survives refresh', () => {
    useDemoStore.getState().setExemplarMode('demo');

    const raw = localStorage.getItem('folio-mapper-demo');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state.exemplarMode).toBe('demo');
  });

  it('does NOT persist isDemoSession or stalePresetWarning (session-scoped)', () => {
    useDemoStore.getState().setExemplarMode('demo');
    useDemoStore.getState().setIsDemoSession(true);
    useDemoStore.getState().setStalePresetWarning({
      payloadPipelineVersion: '0.9.0',
      payloadFolioVersion: null,
      runtimePipelineVersion: '0.9.2',
      runtimeFolioVersion: null,
    });

    const persisted = JSON.parse(localStorage.getItem('folio-mapper-demo') as string);
    expect(persisted.state).toEqual({ exemplarMode: 'demo' });
  });
});
