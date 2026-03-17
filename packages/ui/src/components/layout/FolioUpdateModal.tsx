import { useEffect, useCallback } from 'react';
import type { OWLUpdateStatus } from '@folio-mapper/core';

interface FolioUpdateModalProps {
  status: OWLUpdateStatus;
  onCheck: () => void;
  onForceUpdate: () => void;
  onClose: () => void;
  isChecking: boolean;
  isUpdating: boolean;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatInterval(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m`;
}

function StatusDot({ status, isChecking, isUpdating }: { status: string; isChecking: boolean; isUpdating: boolean }) {
  if (isChecking || isUpdating || status === 'checking' || status === 'updating') {
    return <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />;
  }
  if (status === 'error') {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-500" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-green-500" />;
}

function statusLabel(status: string, isChecking: boolean, isUpdating: boolean): string {
  if (isUpdating || status === 'updating') return 'Updating...';
  if (isChecking || status === 'checking') return 'Checking...';
  if (status === 'error') return 'Error';
  if (status === 'updated') return 'Up to Date';
  return 'Up to Date';
}

export function FolioUpdateModal({ status, onCheck, onForceUpdate, onClose, isChecking, isUpdating }: FolioUpdateModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const busy = isChecking || isUpdating || status.update_status === 'checking' || status.update_status === 'updating';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="FOLIO Ontology"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">FOLIO Ontology</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center gap-2">
            <StatusDot status={status.update_status} isChecking={isChecking} isUpdating={isUpdating} />
            <span className="text-sm font-medium text-gray-700">
              {statusLabel(status.update_status, isChecking, isUpdating)}
            </span>
          </div>

          {/* Error box */}
          {status.error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">{status.error}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last checked</span>
              <span className="font-medium text-gray-700">{formatTimeAgo(status.last_check_time)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last updated</span>
              <span className="font-medium text-gray-700">{formatTimeAgo(status.last_update_time)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onCheck}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(isChecking || status.update_status === 'checking') && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              )}
              Check for Updates
            </button>
            <button
              onClick={onForceUpdate}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(isUpdating || status.update_status === 'updating') && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              )}
              Force Re-download
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Concepts</p>
              <p className="text-sm font-semibold text-gray-800">{status.concept_count.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Labels</p>
              <p className="text-sm font-semibold text-gray-800">{(status.label_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Branches</p>
              <p className="text-sm font-semibold text-gray-800">{(status.branch_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Check Interval</p>
              <p className="text-sm font-semibold text-gray-800">{formatInterval(status.check_interval_seconds)}</p>
            </div>
          </div>

          {/* Technical details */}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Technical details</summary>
            <div className="mt-2 space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Commit SHA</span>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                  {status.owl_commit_sha ? status.owl_commit_sha.slice(0, 8) : 'N/A'}
                </code>
              </div>
              <div className="flex justify-between">
                <span>Source</span>
                <span className="text-gray-700">alea-institute/FOLIO</span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
