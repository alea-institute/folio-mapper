import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PROVIDER_META, type LLMProviderConfig, type LLMProviderType } from '@folio-mapper/core';
import { LLMSettings } from './LLMSettings';

function props(rememberKey = true) {
  return {
    activeProvider: 'anthropic' as const,
    configs: Object.fromEntries(Object.keys(PROVIDER_META).map((provider) => [provider, {
      apiKey: provider === 'anthropic' ? 'synthetic-key' : '', baseUrl: '', model: '',
      connectionStatus: 'valid', keySource: provider === 'anthropic' ? 'manual' : 'none', rememberKey,
    }])) as Record<LLMProviderType, LLMProviderConfig>,
    modelsByProvider: {}, onSetActiveProvider: vi.fn(), onUpdateConfig: vi.fn(),
    onSetConnectionStatus: vi.fn(), onModelsLoaded: vi.fn(), onClose: vi.fn(),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: '' }),
    fetchModels: vi.fn().mockResolvedValue([]), probeModels: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ prices: {} }) })); });

describe('LLMSettings persistence warnings', () => {
  it('warns for a manual browser key even when remembering was requested', async () => {
    const p = props();
    render(<LLMSettings {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(await screen.findByText("Your API key isn't saved")).toBeVisible();
    expect(p.onClose).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

for (const connectionStatus of ['valid', 'untested'] as const) {
  it.each([true, false])(`waits for persistence from ${connectionStatus} and closes only for success %s`, async (saved) => {
    const p = props();
    p.configs.anthropic.connectionStatus = connectionStatus;
    const pending = deferred<boolean>();
    const ensure = vi.fn(() => pending.promise);
    render(<LLMSettings {...p} onEnsureKeySaved={ensure} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    await waitFor(() => expect(ensure).toHaveBeenCalledWith('anthropic'));
    expect(p.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    await act(async () => { pending.resolve(saved); });
    if (saved) expect(p.onClose).toHaveBeenCalledOnce();
    else {
      expect(screen.getByText("Your API key isn't saved")).toBeVisible();
      expect(p.onClose).not.toHaveBeenCalled();
    }
    expect(p.testConnection).toHaveBeenCalledTimes(connectionStatus === 'valid' ? 0 : 1);
  });
}

it.each(['provider', 'key'] as const)('does not close on an obsolete save after a %s change', async (change) => {
  const p = props();
  const pending = deferred<boolean>();
  const ensure = vi.fn(() => pending.promise);
  const view = render(<LLMSettings {...p} onEnsureKeySaved={ensure} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
  const updated = { ...p, configs: { ...p.configs, anthropic: { ...p.configs.anthropic, apiKey: 'synthetic-replacement' } } };
  view.rerender(<LLMSettings {...(change === 'key' ? updated : p)}
    activeProvider={change === 'provider' ? 'openai' : 'anthropic'} onEnsureKeySaved={ensure} />);
  await act(async () => { pending.resolve(true); });
  expect(p.onClose).not.toHaveBeenCalled();
});

it('preserves desktop warnings without invoking browser persistence', async () => {
  const p = props(false);
  const ensure = vi.fn();
  render(<LLMSettings {...p} isDesktop onEnsureKeySaved={ensure} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
  expect(await screen.findByText("Your API key isn't saved")).toBeVisible();
  expect(ensure).not.toHaveBeenCalled();
  expect(p.onClose).not.toHaveBeenCalled();
});

it.each(['saved', 'env', 'keychain', 'none'] as const)('allows closing with source %s', async (source) => {
  const p = props();
  p.configs.anthropic.keySource = source;
  if (source === 'none') p.configs.anthropic.apiKey = '';
  render(<LLMSettings {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
  await waitFor(() => expect(p.onClose).toHaveBeenCalledOnce());
});

it('shows the provider save failure separately from connection validity and clears it on success', async () => {
  const p = props();
  const view = render(<LLMSettings {...p} keySaveStatuses={{ anthropic: { error: 'Safe save failure' } }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Safe save failure');
  fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
  expect(await screen.findByText("Your API key isn't saved")).toBeVisible();
  view.rerender(<LLMSettings {...p} configs={{ ...p.configs, anthropic: { ...p.configs.anthropic, keySource: 'saved' } }} keySaveStatuses={{}} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText("Your API key isn't saved")).not.toBeInTheDocument();
});
