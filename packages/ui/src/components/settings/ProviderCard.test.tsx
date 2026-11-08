import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PROVIDER_META, type LLMProviderConfig } from '@folio-mapper/core';
import { ProviderCard } from './ProviderCard';

function StatefulProvider({ isDesktop, rememberKey }: { isDesktop?: boolean; rememberKey: boolean }) {
  const [config, setConfig] = useState<LLMProviderConfig>({
    apiKey: 'synthetic-original', baseUrl: '', model: '',
    connectionStatus: 'valid', keySource: 'manual', rememberKey,
  });
  return (
    <>
      <ProviderCard
        meta={PROVIDER_META.anthropic} config={config} isActive models={[]}
        isLoadingModels={false} isTesting={false} isDesktop={isDesktop}
        onUpdateConfig={(_, updates) => setConfig((current) => ({ ...current, ...updates }))}
        onSelect={vi.fn()} onTest={vi.fn()} onRefreshModels={vi.fn()}
      />
      <output aria-label="Persistence preference">{String(config.rememberKey)}</output>
    </>
  );
}

describe('ProviderCard key edits', () => {
  const platforms = [
    { name: 'desktop session-only', isDesktop: true, rememberKey: false, expected: false },
    { name: 'desktop remembered', isDesktop: true, rememberKey: true, expected: true },
    { name: 'browser', isDesktop: false, rememberKey: false, expected: true },
    { name: 'default browser', isDesktop: undefined, rememberKey: false, expected: true },
  ];

  for (const platform of platforms) {
    it.each(['synthetic-replacement', ''])(`${platform.name} preserves its persistence policy for key %j`, (key) => {
      render(<StatefulProvider {...platform} />);
      fireEvent.change(screen.getByPlaceholderText('Enter Anthropic API key'), { target: { value: key } });
      expect(screen.getByPlaceholderText('Enter Anthropic API key')).toHaveValue(key);
      expect(screen.getByLabelText('Persistence preference')).toHaveTextContent(String(platform.expected));
      expect(screen.queryByText('✓ Valid')).not.toBeInTheDocument();
      if (key) expect(screen.getByText('Session only')).toBeInTheDocument();
      else expect(screen.queryByText('Session only')).not.toBeInTheDocument();
    });
  }
});
