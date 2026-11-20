import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptKeyDevice, type VaultPayload } from '@folio-mapper/core';
import { useLLMStore } from '../store/llm-store';
import { useBrowserKeyPersistence } from './useBrowserKeyPersistence';

vi.mock('@folio-mapper/core', async (original) => ({
  ...await original<typeof import('@folio-mapper/core')>(),
  encryptKeyDevice: vi.fn(),
}));
const payload = { iv: 'synthetic-iv', cipher: 'synthetic-cipher' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const config = () => useLLMStore.getState().configs.anthropic;
function update(updates: Partial<ReturnType<typeof config>>) {
  act(() => useLLMStore.getState().updateConfig('anthropic', updates));
}

beforeEach(() => {
  localStorage.clear();
  for (const provider of Object.keys(useLLMStore.getState().configs)) {
    useLLMStore.getState().updateConfig(provider as 'anthropic', {
      apiKey: '', keySource: 'none', rememberKey: true, connectionStatus: 'untested',
    });
  }
  update({ apiKey: 'synthetic-first', keySource: 'manual', connectionStatus: 'valid', rememberKey: false });
  vi.mocked(encryptKeyDevice).mockReset().mockResolvedValue(payload);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

for (const target of ['folio-mapper-vault-anthropic', 'folio-mapper-vault-meta']) {
  it(`keeps a failed ${target} write unsaved and permits an unchanged-key retry`, async () => {
    const { result } = renderHook(() => useBrowserKeyPersistence(false));
    const setItem = localStorage.setItem.bind(localStorage);
    const fault = vi.spyOn(localStorage, 'setItem').mockImplementation((name, value) => {
      if (name === target) throw new DOMException('Synthetic sensitive error', 'QuotaExceededError');
      setItem(name, value);
    });
    await act(async () => { await result.current.remember('anthropic', true); });
    await waitFor(() => expect(result.current.statuses.anthropic?.error).toBeTruthy());
    expect(config()).toMatchObject({ apiKey: 'synthetic-first', keySource: 'manual', connectionStatus: 'valid' });
    expect(result.current.statuses.anthropic?.error).not.toContain('Synthetic sensitive error');
    const attempts = vi.mocked(encryptKeyDevice).mock.calls.length;
    update({ model: 'different-model' });
    await act(async () => { expect(await result.current.ensureSaved('anthropic')).toBe(false); });
    expect(encryptKeyDevice).toHaveBeenCalledTimes(attempts);
    fault.mockRestore();
    await act(async () => { expect(await result.current.remember('anthropic', true)).toBe(true); });
    expect(config().keySource).toBe('saved');
    expect(result.current.statuses.anthropic?.error).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('folio-mapper-vault-meta')!).providers).toEqual(['anthropic']);
  });
}

it('waits for storage and keeps late duplicate failure from demoting success', async () => {
  const older = deferred<VaultPayload>();
  const newer = deferred<VaultPayload>();
  vi.mocked(encryptKeyDevice).mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise);
  const { result } = renderHook(() => useBrowserKeyPersistence(false));
  let request!: Promise<boolean>;
  act(() => { request = result.current.remember('anthropic', true); });
  await waitFor(() => expect(encryptKeyDevice).toHaveBeenCalledTimes(2));
  expect(config().keySource).toBe('manual');
  expect(result.current.statuses.anthropic?.pending).toBe(true);
  await act(async () => { newer.resolve(payload); });
  expect(config().keySource).toBe('saved');
  await act(async () => { expect(await result.current.ensureSaved('anthropic')).toBe(true); });
  await act(async () => { older.reject(new Error('late failure')); await request; });
  expect(config().keySource).toBe('saved');
  expect(result.current.statuses.anthropic?.error).toBeUndefined();
});

it.each(['edit', 'forget', 'edit-back'] as const)('ignores obsolete success and failure after %s', async (change) => {
  const old = deferred<VaultPayload>();
  vi.mocked(encryptKeyDevice).mockImplementation(() => old.promise);
  const { result } = renderHook(() => useBrowserKeyPersistence(false));
  let request!: Promise<boolean>;
  act(() => { request = result.current.remember('anthropic', true); });
  if (change === 'forget') {
    act(() => { result.current.invalidate('anthropic'); });
    update({ rememberKey: false });
  } else {
    update({ apiKey: 'synthetic-replacement', connectionStatus: 'untested' });
    if (change === 'edit-back') update({ apiKey: 'synthetic-first' });
  }
  await act(async () => { old.resolve(payload); expect(await request).toBe(false); });
  expect(config().keySource).toBe('manual');
  expect(localStorage.getItem('folio-mapper-vault-anthropic')).toBeNull();
  expect(result.current.statuses.anthropic?.error).toBeUndefined();
});

it('does not resave forgotten keys or automatically save desktop keys', async () => {
  const { result, rerender } = renderHook((desktop) => useBrowserKeyPersistence(desktop), { initialProps: false });
  await act(async () => { expect(await result.current.ensureSaved('anthropic')).toBe(false); });
  rerender(true);
  update({ rememberKey: true });
  expect(encryptKeyDevice).not.toHaveBeenCalled();
});

it('fences an obsolete rejection and lets a new validated replacement save', async () => {
  const old = deferred<VaultPayload>();
  vi.mocked(encryptKeyDevice).mockImplementationOnce(() => old.promise).mockImplementationOnce(() => old.promise);
  const { result } = renderHook(() => useBrowserKeyPersistence(false));
  let request!: Promise<boolean>;
  act(() => { request = result.current.remember('anthropic', true); });
  update({ apiKey: 'synthetic-replacement', connectionStatus: 'untested' });
  await act(async () => { old.reject(new Error('obsolete')); await request; });
  expect(result.current.statuses.anthropic?.error).toBeUndefined();
  update({ connectionStatus: 'valid' });
  await waitFor(() => expect(config().keySource).toBe('saved'));
  expect(result.current.statuses.anthropic?.error).toBeUndefined();
});

it('keeps provider failures isolated and pending/error state out of the persisted store', async () => {
  vi.mocked(encryptKeyDevice).mockRejectedValueOnce(new Error('synthetic-first'));
  update({ rememberKey: true });
  const { result } = renderHook(() => useBrowserKeyPersistence(false));
  await waitFor(() => expect(result.current.statuses.anthropic?.error).toBeTruthy());
  act(() => useLLMStore.getState().updateConfig('openai', {
    apiKey: 'synthetic-openai', keySource: 'manual', connectionStatus: 'valid', rememberKey: true,
  }));
  await waitFor(() => expect(useLLMStore.getState().configs.openai.keySource).toBe('saved'));
  expect(result.current.statuses.anthropic?.error).toBeTruthy();
  const stored = localStorage.getItem('folio-mapper-llm')!;
  expect(stored).not.toContain('synthetic-first');
  expect(stored).not.toContain('synthetic-openai');
  expect(stored).not.toContain('error');
  expect(stored).not.toContain('pending');
});
