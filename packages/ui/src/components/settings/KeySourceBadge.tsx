import type { KeySource } from '@folio-mapper/core';

interface KeySourceBadgeProps {
  source: KeySource;
  saveUnconfirmed?: boolean;
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
    label: 'Session only',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    tooltip: 'Key in memory only — will be lost on page reload',
  },
};

export function KeySourceBadge({ source, saveUnconfirmed }: KeySourceBadgeProps) {
  const config = BADGE_CONFIG[source];
  if (!config) return null;
  const unconfirmed = source === 'manual' && saveUnconfirmed;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${config.className}`}
      title={unconfirmed ? 'Saving did not finish; browser storage may contain a partial save.' : config.tooltip}
    >
      {unconfirmed ? 'Save unconfirmed' : config.label}
    </span>
  );
}
