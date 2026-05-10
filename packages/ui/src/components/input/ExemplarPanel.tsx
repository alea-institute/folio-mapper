interface ExemplarItem {
  id: string;
  label: string;
  description: string;
}

export interface ExemplarPanelProps {
  exemplars: ExemplarItem[];
  isLoading: boolean;
  loadingId: string | null;
  onSelect: (id: string) => void;
  exemplarMode: 'lean' | 'demo';
  onToggleMode: () => void;
}

export function ExemplarPanel({
  exemplars,
  isLoading,
  loadingId,
  onSelect,
  exemplarMode,
  onToggleMode,
}: ExemplarPanelProps) {
  const isDemo = exemplarMode === 'demo';

  return (
    <div className="rounded-lg border-2 border-dashed border-teal-300 bg-teal-50/50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-teal-800">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span>Try an Exemplar</span>
        <button
          type="button"
          data-testid="demo-toggle"
          aria-pressed={isDemo}
          onClick={onToggleMode}
          className={
            'ml-auto rounded-md px-2 py-1 text-xs font-semibold transition-colors ' +
            (isDemo
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'border border-teal-300 bg-white text-teal-700 hover:bg-teal-50')
          }
        >
          Demo
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Load a pre-built legal practice area to explore FOLIO mapping — no LLM needed.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {exemplars.map((ex) => {
          const isThisLoading = loadingId === ex.id;
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              disabled={isLoading}
              title={ex.description}
              className="relative flex items-center justify-center gap-1.5 rounded-md border border-teal-300 bg-white px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDemo && (
                <span
                  data-testid="demo-chip"
                  className="absolute top-1 right-1 rounded-sm bg-teal-600 px-1 text-[9px] font-bold uppercase tracking-wider text-white"
                >
                  Demo
                </span>
              )}
              {isThisLoading && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600" />
              )}
              {ex.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
