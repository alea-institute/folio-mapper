export interface StalePresetBannerProps {
  payloadPipelineVersion: string | null;
  payloadFolioVersion: string | null;
  runtimePipelineVersion: string | null;
  runtimeFolioVersion: string | null;
  onDismiss: () => void;
}

/**
 * Non-blocking, dismissible banner shown when a Demo Mode payload's
 * `pipeline_version` / `folio_version` snapshots disagree with the
 * running app. Surfaces version drift without preventing demo use.
 *
 * Renders nothing if no version pair actually differs (defensive — the
 * parent already gates on a non-null warning, but a callsite that always
 * sets the warning should not produce a misleading banner).
 */
export function StalePresetBanner({
  payloadPipelineVersion,
  payloadFolioVersion,
  runtimePipelineVersion,
  runtimeFolioVersion,
  onDismiss,
}: StalePresetBannerProps) {
  const pipelineDiffers =
    payloadPipelineVersion !== null &&
    runtimePipelineVersion !== null &&
    payloadPipelineVersion !== runtimePipelineVersion;
  const folioDiffers =
    payloadFolioVersion !== null &&
    runtimeFolioVersion !== null &&
    payloadFolioVersion !== runtimeFolioVersion;

  if (!pipelineDiffers && !folioDiffers) return null;

  const fmt = (v: string | null) => v ?? 'unknown';

  return (
    <div
      data-testid="stale-preset-banner"
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900"
    >
      <svg
        className="h-4 w-4 flex-shrink-0 text-amber-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <span className="flex-1 leading-snug">
        <strong className="font-semibold">Demo preset may be slightly stale.</strong>
        {pipelineDiffers && (
          <>
            {' '}Pipeline <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">{fmt(payloadPipelineVersion)}</code> vs runtime{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">{fmt(runtimePipelineVersion)}</code>.
          </>
        )}
        {folioDiffers && (
          <>
            {' '}FOLIO <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">{fmt(payloadFolioVersion)}</code> vs{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">{fmt(runtimeFolioVersion)}</code>.
          </>
        )}
      </span>
      <button
        type="button"
        data-testid="stale-preset-dismiss"
        onClick={onDismiss}
        className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        aria-label="Dismiss stale demo preset warning"
      >
        Dismiss
      </button>
    </div>
  );
}
