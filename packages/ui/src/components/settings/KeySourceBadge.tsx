import type { KeySource } from '@folio-mapper/core';

interface KeySourceBadgeProps {
  source: KeySource;
}

const BADGE_CONFIG: Record<KeySource, { label: string; className: string; tooltip: string } | null> = {
  none: null,
  env: {
    label: 'Env',
    className: 'bg-green-100 text-green-700 border-green-200',
    tooltip: 'Key provided via server environment variable',
  },
  keychain: {
    label: 'Keychain',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    tooltip: 'Key stored in OS secure storage',
  },
  saved: {
    label: 'Encrypted',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    tooltip: 'Key encrypted in browser storage',
  },
  manual: {
    label: 'Session',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    tooltip: 'Key in memory only — lost on reload',
  },
};

export function KeySourceBadge({ source }: KeySourceBadgeProps) {
  const config = BADGE_CONFIG[source];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${config.className}`}
      title={config.tooltip}
    >
      {config.label}
    </span>
  );
}
