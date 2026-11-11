import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PROVIDER_META, type LLMProviderConfig, type LLMProviderType } from '@folio-mapper/core';
import { ModelChooser } from './ModelChooser';

function StatefulChooser({ isDesktop, rememberKey }: { isDesktop?: boolean; rememberKey: boolean }) {
  const [configs, setConfigs] = useState(() => Object.fromEntries(
    Object.keys(PROVIDER_META).map((provider) => [provider, {
      apiKey: provider === 'anthropic' ? 'synthetic-original' : '',
      baseUrl: '', model: '',
      connectionStatus: provider === 'anthropic' ? 'valid' : 'untested',
      keySource: provider === 'anthropic' ? 'manual' : 'none',
      rememberKey,
    }]),
  ) as Record<LLMProviderType, LLMProviderConfig>);
  const platform = isDesktop === undefined ? {} : { isDesktop };
  return (
    <>
      <ModelChooser
        {...platform}
        activeProvider="anthropic" configs={configs} modelsByProvider={{}}
        onUpdateConfig={(provider, updates) => setConfigs((current) => ({
          ...current, [provider]: { ...current[provider], ...updates },
        }))}
        onSetActiveProvider={vi.fn()} onSetConnectionStatus={vi.fn()}
        onModelsLoaded={vi.fn()} testConnection={vi.fn()} fetchModels={vi.fn()}
      />
      <output aria-label="Persistence preference">{String(configs.anthropic.rememberKey)}</output>
      <output aria-label="Connection status">{configs.anthropic.connectionStatus}</output>
    </>
  );
}

describe('ModelChooser key edits', () => {
  const platforms = [
    { name: 'desktop session-only', isDesktop: true, rememberKey: false, expected: false },
    { name: 'desktop remembered', isDesktop: true, rememberKey: true, expected: true },
    { name: 'browser', isDesktop: false, rememberKey: false, expected: true },
    { name: 'default browser', isDesktop: undefined, rememberKey: false, expected: true },
  ];

  for (const platform of platforms) {
    it.each(['synthetic-replacement', ''])(`${platform.name} preserves its persistence policy for key %j`, (key) => {
      render(<StatefulChooser {...platform} />);
      expect(screen.getByText('✓ Valid')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Enter Anthropic API key'), { target: { value: key } });
      expect(screen.getByPlaceholderText('Enter Anthropic API key')).toHaveValue(key);
      expect(screen.getByLabelText('Persistence preference')).toHaveTextContent(String(platform.expected));
      expect(screen.getByLabelText('Connection status')).toHaveTextContent('untested');
      expect(screen.queryByText('✓ Valid')).not.toBeInTheDocument();
      if (key) expect(screen.getByText('Session only')).toBeInTheDocument();
      else expect(screen.queryByText('Session only')).not.toBeInTheDocument();
    });
  }
});
