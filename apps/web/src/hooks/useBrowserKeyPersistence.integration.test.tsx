import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LLMSettings } from '@folio-mapper/ui';
import { useLLMStore } from '../store/llm-store';
import { useBrowserKeyPersistence } from './useBrowserKeyPersistence';

vi.mock('@folio-mapper/core', async (original) => ({
  ...await original<typeof import('@folio-mapper/core')>(),
  encryptKeyDevice: vi.fn().mockResolvedValue({ iv: 'synthetic', cipher: 'ciphertext' }),
}));

function Settings({ onClose }: { onClose: () => void }) {
  const store = useLLMStore();
  const persistence = useBrowserKeyPersistence(false);
  return <LLMSettings activeProvider="anthropic" configs={store.configs} modelsByProvider={{}}
    onSetActiveProvider={store.setActiveProvider} onUpdateConfig={store.updateConfig}
    onSetConnectionStatus={store.setConnectionStatus} onModelsLoaded={vi.fn()}
    onRememberKey={persistence.remember} onEnsureKeySaved={persistence.ensureSaved}
    keySaveStatuses={persistence.statuses} onClearSavedKey={vi.fn()} onClose={onClose}
    testConnection={async () => ({ success: true, message: '' })}
    fetchModels={async () => []} probeModels={async () => []} />;
}

beforeEach(() => {
  localStorage.clear();
  useLLMStore.getState().updateConfig('anthropic', {
    apiKey: 'synthetic-key', keySource: 'manual', rememberKey: false, connectionStatus: 'valid',
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ prices: {} }) }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('a real vault exception keeps the warning, then an unchanged-key retry clears it and allows closing', async () => {
  const onClose = vi.fn();
  const view = render(<Settings onClose={onClose} />);
  const setItem = localStorage.setItem.bind(localStorage);
  const fault = vi.spyOn(localStorage, 'setItem').mockImplementation((name, value) => {
    if (name === 'folio-mapper-vault-anthropic') throw new DOMException('synthetic-key', 'QuotaExceededError');
    setItem(name, value);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save (encrypted)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save this key in your browser.");
  expect(screen.getByRole('alert')).not.toHaveTextContent('synthetic-key');
  expect(screen.getByPlaceholderText('Enter Anthropic API key')).toHaveValue('synthetic-key');
  expect(screen.queryByText('Key saved')).not.toBeInTheDocument();
  expect(screen.getByText('✓ Valid')).toBeVisible();
  expect(localStorage.getItem('folio-mapper-vault-anthropic')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
  expect(await screen.findByText("Your API key isn't saved")).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  view.rerender(<Settings onClose={onClose} />);
  expect(screen.getByRole('alert')).toBeVisible();
  fault.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Save (encrypted)' }));
  await waitFor(() => expect(screen.getByText('Key saved')).toBeVisible());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText("Your API key isn't saved")).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & Close' })); });
  expect(onClose).toHaveBeenCalledOnce();
});
