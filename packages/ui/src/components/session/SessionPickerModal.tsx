import { useEffect, useRef } from 'react';

// SessionRecord shape mirrored from apps/web/src/store/session-registry.ts
// UI package cannot depend on the web app, so we define a compatible interface.
interface SessionRecord {
  tabId: string;
  updatedAt: string;
  createdAt: string;
  totalNodes: number;
  completed: number;
  skipped: number;
  sourceFile: string | null;
}

interface SessionPickerModalProps {
  sessions: SessionRecord[];
  currentTabId: string;
  onResume: (tabId: string) => void;
  onDelete: (tabId: string) => void;
  onStartNew: () => void;
  onClose: () => void;
}

export function SessionPickerModal({
  sessions,
  currentTabId,
  onResume,
  onDelete,
  onStartNew,
  onClose,
}: SessionPickerModalProps) {
  // Sort descending by updatedAt (D-14 default sort)
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // WR-03: dialog accessibility — Escape closes, focus moves into the dialog on
  // open, and Tab is trapped so keyboard users can't reach the obscured page.
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Saved sessions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Open Recent Session</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close session picker"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-4 text-sm text-gray-500">No saved sessions yet.</p>
            <button
              onClick={onStartNew}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              aria-label="Open a new tab"
            >
              Start New
            </button>
          </div>
        ) : (
          <>
            <ul className="mb-4 divide-y divide-gray-100" role="list" aria-label="Session list">
              {sorted.map((session) => {
                const pct = session.totalNodes > 0
                  ? Math.round((session.completed / session.totalNodes) * 100)
                  : 0;
                const isCurrent = session.tabId === currentTabId;

                return (
                  <li
                    key={session.tabId}
                    className={`py-3 ${isCurrent ? 'rounded-md bg-blue-50 px-2' : ''}`}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <div className="mb-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-800">
                          {session.sourceFile ?? 'Untitled'}
                        </span>
                        {isCurrent && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600">
                        Saved: <span className="font-medium text-gray-800">{formatDate(session.updatedAt)}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Progress:{' '}
                        <span className="font-medium text-gray-800">
                          {session.completed} of {session.totalNodes} nodes ({pct}%)
                        </span>
                      </p>
                      {session.skipped > 0 && (
                        <p className="text-sm text-gray-600">
                          Skipped: <span className="font-medium text-gray-800">{session.skipped}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => onResume(session.tabId)}
                        className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        aria-label={`Resume session: ${session.sourceFile ?? 'Untitled'}`}
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => onDelete(session.tabId)}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        aria-label={`Delete session: ${session.sourceFile ?? 'Untitled'}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <button
                onClick={onStartNew}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Open a new tab"
              >
                Start New
              </button>
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600"
                aria-label="Close session picker"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
