import { useState, useCallback, useEffect } from 'react';
import type { ConnectionStatus, LLMProviderConfig, LLMProviderType, LlamafileStatus as LlamafileStatusType, ModelInfo, ModelStatus } from '@folio-mapper/core';
import { CLOUD_PROVIDERS, LOCAL_PROVIDERS, PROVIDER_META } from '@folio-mapper/core';
import { ProviderCard } from './ProviderCard';
import { LlamafileStatus } from './LlamafileStatus';
import { LlamafileModelPicker } from './LlamafileModelPicker';

interface LLMSettingsProps {
  activeProvider: LLMProviderType;
  configs: Record<LLMProviderType, LLMProviderConfig>;
  modelsByProvider: Record<string, ModelInfo[]>;
  isDesktop?: boolean;
  onSetActiveProvider: (provider: LLMProviderType) => void;
  onUpdateConfig: (provider: LLMProviderType, updates: Partial<LLMProviderConfig>) => void;
  onSetConnectionStatus: (provider: LLMProviderType, status: ConnectionStatus) => void;
  onModelsLoaded: (provider: string, models: ModelInfo[]) => void;
  onSaveToKeychain?: (provider: LLMProviderType) => void;
  onRememberKey?: (provider: LLMProviderType, remember: boolean) => void;
  onClearSavedKey?: (provider: LLMProviderType) => void;
  onClearAllSavedKeys?: () => void;
  llamafileStatus?: LlamafileStatusType | null;
  llamafileModels?: ModelStatus[];
  onDownloadModel?: (modelId: string) => void;
  onDeleteModel?: (modelId: string) => void;
  onSetActiveModel?: (modelId: string) => void;
  onClose: () => void;
  testConnection: (
    provider: LLMProviderType,
    apiKey?: string,
    baseUrl?: string,
    model?: string,
  ) => Promise<{ success: boolean; message: string }>;
  fetchModels: (
    provider: LLMProviderType,
    apiKey?: string,
    baseUrl?: string,
  ) => Promise<ModelInfo[]>;
}

export function LLMSettings({
  activeProvider,
  configs,
  modelsByProvider,
  isDesktop,
  onSetActiveProvider,
  onUpdateConfig,
  onSetConnectionStatus,
  onModelsLoaded,
  onSaveToKeychain,
  onRememberKey,
  onClearSavedKey,
  onClearAllSavedKeys,
  llamafileStatus,
  llamafileModels,
  onDownloadModel,
  onDeleteModel,
  onSetActiveModel,
  onClose,
  testConnection,
  fetchModels,
}: LLMSettingsProps) {
  const [testingProvider, setTestingProvider] = useState<LLMProviderType | null>(null);
  const [loadingModelsFor, setLoadingModelsFor] = useState<Set<LLMProviderType>>(new Set());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedKeyPrompt, setShowUnsavedKeyPrompt] = useState(false);

  // Clear error when provider changes
  useEffect(() => { setSaveError(null); }, [activeProvider]);

  // Auto-refresh models when modal opens if API key is available
  useEffect(() => {
    const config = configs[activeProvider];
    if (config.apiKey) {
      handleRefreshModels(activeProvider);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh models when switching to a provider with an API key
  useEffect(() => {
    const config = configs[activeProvider];
    if (config.apiKey && !loadingModelsFor.has(activeProvider)) {
      handleRefreshModels(activeProvider);
    }
  }, [activeProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) closeModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  useEffect(() => {
    fetch('/api/llm/pricing')
      .then((r) => r.json())
      .then((data) => {
        if (data.prices) setPrices(data.prices);
      })
      .catch(() => {});
  }, []);

  const handleTest = useCallback(
    async (provider: LLMProviderType) => {
      const config = configs[provider];
      setTestingProvider(provider);
      try {
        const result = await testConnection(
          provider,
          config.apiKey || undefined,
          config.baseUrl || undefined,
          config.model || undefined,
        );
        onSetConnectionStatus(provider, result.success ? 'valid' : 'invalid');
      } catch {
        onSetConnectionStatus(provider, 'invalid');
      } finally {
        setTestingProvider(null);
      }
    },
    [configs, testConnection, onSetConnectionStatus],
  );

  const handleRefreshModels = useCallback(
    async (provider: LLMProviderType) => {
      const config = configs[provider];
      setLoadingModelsFor((prev) => new Set(prev).add(provider));
      try {
        const models = await fetchModels(
          provider,
          config.apiKey || undefined,
          config.baseUrl || undefined,
        );
        onModelsLoaded(provider, models);
      } catch {
        // Keep existing models on error
      } finally {
        setLoadingModelsFor((prev) => {
          const next = new Set(prev);
          next.delete(provider);
          return next;
        });
      }
    },
    [configs, fetchModels, onModelsLoaded],
  );

  const hasUnsavedKey = useCallback((provider: LLMProviderType) => {
    const c = configs[provider];
    const ks = c.keySource ?? 'none';
    return c.apiKey && ks === 'manual' && !c.rememberKey && ks !== 'env' && ks !== 'keychain' && ks !== 'saved';
  }, [configs]);

  const closeModal = useCallback(() => {
    setShowUnsavedKeyPrompt(false);
    setSaveError(null);
    onClose();
  }, [onClose]);

  const handleSaveAndClose = useCallback(async () => {
    const config = configs[activeProvider];
    // If already validated, check for unsaved key before closing
    if (config.connectionStatus === 'valid') {
      setSaveError(null);
      if (hasUnsavedKey(activeProvider)) {
        setShowUnsavedKeyPrompt(true);
        return;
      }
      closeModal();
      return;
    }

    // Test the active provider's connection
    setSaveError(null);
    setIsSaving(true);
    setTestingProvider(activeProvider);
    try {
      const result = await testConnection(
        activeProvider,
        config.apiKey || undefined,
        config.baseUrl || undefined,
        config.model || undefined,
      );
      onSetConnectionStatus(activeProvider, result.success ? 'valid' : 'invalid');
      if (result.success) {
        if (hasUnsavedKey(activeProvider)) {
          setShowUnsavedKeyPrompt(true);
        } else {
          closeModal();
        }
      } else {
        setSaveError(result.message || 'Connection test failed. Please check your API key and try again.');
      }
    } catch {
      onSetConnectionStatus(activeProvider, 'invalid');
      setSaveError('Connection test failed. Please check your API key and try again.');
    } finally {
      setTestingProvider(null);
      setIsSaving(false);
    }
  }, [activeProvider, configs, testConnection, onSetConnectionStatus, closeModal, hasUnsavedKey]);

  const renderProviderSection = (title: string, providers: LLMProviderType[]) => (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="space-y-2">
        {providers.map((type) => (
          <div key={type}>
            <ProviderCard
              meta={PROVIDER_META[type]}
              config={configs[type]}
              isActive={activeProvider === type}
              models={modelsByProvider[type] || []}
              isLoadingModels={loadingModelsFor.has(type)}
              isTesting={testingProvider === type}
              isDesktop={isDesktop}
              onSelect={onSetActiveProvider}
              onUpdateConfig={onUpdateConfig}
              onTest={handleTest}
              onRefreshModels={handleRefreshModels}
              onSaveToKeychain={onSaveToKeychain}
              onRememberKey={onRememberKey}
              onClearSavedKey={onClearSavedKey}
              prices={prices}
            />
            {type === 'llamafile' && (
              <>
                <LlamafileStatus status={llamafileStatus ?? null} />
                {llamafileModels && llamafileModels.length > 0 && onDownloadModel && onDeleteModel && onSetActiveModel && (
                  <LlamafileModelPicker
                    models={llamafileModels}
                    onDownload={onDownloadModel}
                    onDelete={onDeleteModel}
                    onSetActive={onSetActiveModel}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">LLM Provider Settings</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={closeModal}
              disabled={isSaving}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-blue-300"
            >
              {isSaving ? 'Testing...' : 'Save & Close'}
            </button>
          </div>
        </div>

        {/* Connection error banner */}
        {saveError && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {saveError}
          </div>
        )}

        {/* Unsaved key prompt — shown when closing with a key that won't persist */}
        {showUnsavedKeyPrompt && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  Your API key isn&apos;t saved
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  It will be lost when you refresh or close the tab. Save it to avoid re-entering it next time.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {isDesktop && onSaveToKeychain ? (
                    <button
                      onClick={() => {
                        onSaveToKeychain(activeProvider);
                        closeModal();
                      }}
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                    >
                      Save to keychain
                    </button>
                  ) : onRememberKey ? (
                    <button
                      onClick={() => {
                        onRememberKey(activeProvider, true);
                        // Don't close — passphrase modal may appear
                      }}
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                    >
                      Save key (encrypted)
                    </button>
                  ) : null}
                  <button
                    onClick={closeModal}
                    className="rounded px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
                  >
                    Close without saving
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="space-y-6 px-6 py-4">
          {renderProviderSection('Cloud Providers', CLOUD_PROVIDERS)}
          {renderProviderSection('Local Models', LOCAL_PROVIDERS)}

          {/* Clear all saved keys */}
          {onClearAllSavedKeys && (
            <div className="border-t border-gray-200 pt-3">
              <button
                onClick={onClearAllSavedKeys}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear all saved API keys
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
