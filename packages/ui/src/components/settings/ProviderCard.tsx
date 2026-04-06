import type { ConnectionStatus, KeySource, LLMProviderConfig, LLMProviderType, ModelInfo, ProviderMeta } from '@folio-mapper/core';
import { KeySourceBadge } from './KeySourceBadge';

interface ProviderCardProps {
  meta: ProviderMeta;
  config: LLMProviderConfig;
  isActive: boolean;
  models: ModelInfo[];
  isLoadingModels: boolean;
  isTesting: boolean;
  isDesktop?: boolean;
  onSelect: (provider: LLMProviderType) => void;
  onUpdateConfig: (provider: LLMProviderType, updates: Partial<LLMProviderConfig>) => void;
  onTest: (provider: LLMProviderType) => void;
  onRefreshModels: (provider: LLMProviderType) => void;
  onSaveToKeychain?: (provider: LLMProviderType) => void;
  onRememberKey?: (provider: LLMProviderType, remember: boolean) => void;
  onClearSavedKey?: (provider: LLMProviderType) => void;
  prices?: Record<string, number>;
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return key.slice(0, 3) + '••••' + key.slice(-4);
}

function statusIndicator(status: ConnectionStatus) {
  switch (status) {
    case 'valid':
      return <span className="text-green-600 text-sm font-medium">&#10003; Valid</span>;
    case 'invalid':
      return <span className="text-red-600 text-sm font-medium">&#10007; Invalid</span>;
    default:
      return null;
  }
}

function formatCost(cost: number): string {
  if (cost >= 0.01) return `~$${cost.toFixed(3)}`;
  return `~$${cost.toFixed(4)}`;
}

export function ProviderCard({
  meta,
  config,
  isActive,
  models,
  isLoadingModels,
  isTesting,
  isDesktop,
  onSelect,
  onUpdateConfig,
  onTest,
  onRefreshModels,
  onSaveToKeychain,
  onRememberKey,
  onClearSavedKey,
  prices,
}: ProviderCardProps) {
  const showKeyInput = meta.requiresApiKey;
  const showUrlInput = meta.isLocal || meta.type === 'custom';
  const isLocal = meta.isLocal;
  const keySource = config.keySource ?? 'none';
  const isEnvKey = keySource === 'env';
  const hasSavedKey = keySource === 'keychain' || keySource === 'saved';

  const costLabel = (() => {
    if (!config.model) return null;
    if (isLocal) return 'Free (local)';
    if (!prices || Object.keys(prices).length === 0) return null;
    const cost = prices[config.model];
    if (cost == null) return null;
    return `Est. cost: ${formatCost(cost)} per pipeline node`;
  })();

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isActive ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Radio button */}
        <label className="mt-0.5 flex cursor-pointer items-center">
          <input
            type="radio"
            name="llm-provider"
            checked={isActive}
            onChange={() => onSelect(meta.type)}
            className="h-4 w-4 text-blue-600"
          />
        </label>

        <div className="min-w-0 flex-1">
          {/* Provider name + badge + test button + status */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{meta.displayName}</span>
            <KeySourceBadge source={keySource} />
            <button
              onClick={() => onTest(meta.type)}
              disabled={isTesting || (meta.requiresApiKey && !config.apiKey && !isEnvKey)}
              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test'}
            </button>
            {statusIndicator(config.connectionStatus)}
          </div>

          {/* API key input */}
          {showKeyInput && (
            <div className="mt-2">
              {isEnvKey ? (
                <div className="flex items-center gap-2">
                  <label className="w-10 shrink-0 text-xs text-gray-500">Key:</label>
                  <span className="flex-1 text-sm text-green-700">Provided via server environment</span>
                  <button
                    onClick={() => {
                      onUpdateConfig(meta.type, { keySource: 'manual' as const });
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Override
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <label className="w-10 shrink-0 text-xs text-gray-500">Key:</label>
                    <input
                      type="password"
                      value={config.apiKey || ''}
                      onChange={(e) =>
                        onUpdateConfig(meta.type, {
                          apiKey: e.target.value,
                          connectionStatus: 'untested',
                          keySource: e.target.value ? 'manual' : 'none',
                        })
                      }
                      placeholder={`Enter ${meta.displayName} API key`}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    {config.apiKey && (
                      <span className="shrink-0 text-xs text-gray-400">{maskKey(config.apiKey)}</span>
                    )}
                  </div>
                  {/* Key persistence actions */}
                  {config.apiKey && (
                    <div className="mt-1.5 ml-12">
                      {/* Prominent save prompt — shown when key is verified but not saved */}
                      {!hasSavedKey && config.connectionStatus === 'valid' && keySource === 'manual' && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                          <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span className="flex-1 text-xs font-medium text-amber-800">
                            Key verified — save it so you don&apos;t have to re-enter it?
                          </span>
                          {isDesktop && onSaveToKeychain ? (
                            <button
                              onClick={() => onSaveToKeychain(meta.type)}
                              className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
                            >
                              Save to keychain
                            </button>
                          ) : onRememberKey ? (
                            <button
                              onClick={() => onRememberKey(meta.type, true)}
                              className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
                            >
                              Save (encrypted)
                            </button>
                          ) : null}
                        </div>
                      )}
                      {/* Quiet save options — shown when key exists but hasn't been tested yet */}
                      {!hasSavedKey && config.connectionStatus !== 'valid' && (
                        <div className="flex items-center gap-3">
                          {isDesktop && onSaveToKeychain && keySource !== 'keychain' && (
                            <button
                              onClick={() => onSaveToKeychain(meta.type)}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              Save to keychain
                            </button>
                          )}
                          {!isDesktop && onRememberKey && keySource !== 'saved' && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                              <input
                                type="checkbox"
                                checked={config.rememberKey ?? false}
                                onChange={(e) => onRememberKey(meta.type, e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                              />
                              Remember key (encrypted in browser)
                            </label>
                          )}
                        </div>
                      )}
                      {/* Already saved — show status + forget option */}
                      {hasSavedKey && onClearSavedKey && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600">
                            <svg className="mr-0.5 inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Key saved
                          </span>
                          <button
                            onClick={() => onClearSavedKey(meta.type)}
                            className="text-xs text-gray-400 hover:text-red-500"
                          >
                            Forget
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Base URL input (local / custom) */}
          {showUrlInput && (
            <div className="mt-2 flex items-center gap-2">
              <label className="w-10 shrink-0 text-xs text-gray-500">URL:</label>
              <input
                type="text"
                value={config.baseUrl || ''}
                onChange={(e) =>
                  onUpdateConfig(meta.type, {
                    baseUrl: e.target.value,
                    connectionStatus: 'untested',
                  })
                }
                placeholder={meta.defaultBaseUrl}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          )}

          {/* Model dropdown */}
          <div className="mt-2 flex items-center gap-2">
            <label className="w-10 shrink-0 text-xs text-gray-500">Model:</label>
            <select
              value={config.model || ''}
              onChange={(e) => onUpdateConfig(meta.type, { model: e.target.value })}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            >
              {config.model && models.length === 0 && (
                <option value={config.model}>{config.model}</option>
              )}
              {!config.model && <option value="">Select a model...</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.context_window ? ` (${Math.round(m.context_window / 1000)}K)` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => onRefreshModels(meta.type)}
              disabled={isLoadingModels}
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh models"
            >
              {isLoadingModels ? '...' : '↻'}
            </button>
          </div>

          {/* Per-model cost estimate */}
          {costLabel && (
            <div className="mt-1 ml-12 text-xs text-gray-400">
              {costLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
