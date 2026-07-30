'use client';

import { FeedSource } from '../types';

interface SourceFilterProps {
  sources: FeedSource[];
  /** null = "All". */
  selectedId: string | null;
  onSelect: (sourceId: string | null) => void;
  totalArticles: number;
  disabled?: boolean;
}

/**
 * Pill filters for the feed, one per source plus "All".
 *
 * The list is driven entirely by the sources the API reports, so adding a
 * source adds its pill with no change here.
 */
export function SourceFilter({
  sources,
  selectedId,
  onSelect,
  totalArticles,
  disabled = false,
}: SourceFilterProps) {
  // With one source, "All" and that source are the same view.
  if (sources.length < 2) return null;

  const options: Array<{ id: string | null; label: string; count: number }> = [
    { id: null, label: 'All', count: totalArticles },
    ...sources.map((s) => ({ id: s.id, label: s.label, count: s.articleCount })),
  ];

  return (
    <div
      role="group"
      aria-label="Filter articles by source"
      className="mb-6 flex flex-wrap items-center gap-2"
    >
      {options.map((option) => {
        const isSelected = option.id === selectedId;

        return (
          <button
            key={option.id ?? 'all'}
            type="button"
            onClick={() => onSelect(option.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={[
              'group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              'border transition-all duration-200 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2',
              'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isSelected
                ? // Selected: indigo gradient with a soft glow, matching the
                  // indigo accent used for links and the guest badge.
                  'border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 text-white ' +
                  'shadow-md shadow-indigo-500/25 dark:shadow-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 ' +
                  'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 ' +
                  'dark:hover:bg-slate-700 dark:hover:text-indigo-300',
            ].join(' ')}
          >
            {option.label}
            <span
              aria-hidden="true"
              className={[
                'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors',
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700 ' +
                    'dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-slate-600 dark:group-hover:text-indigo-300',
              ].join(' ')}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
