'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalArticles: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Dims the control while the next page is in flight. */
  disabled?: boolean;
}

/**
 * Builds a compact page list with ellipses, e.g. 1 … 4 5 6 … 12.
 * Always includes the first and last page so those stay one click away.
 */
function pageItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: Array<number | 'gap'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push('gap');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('gap');

  items.push(total);
  return items;
}

export function Pagination({
  currentPage,
  totalPages,
  totalArticles,
  pageSize,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalArticles === 0) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalArticles);

  const navButton =
    'px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium ' +
    'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <nav
      aria-label="Article pagination"
      className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        Showing <span className="font-medium text-slate-700 dark:text-slate-200">{firstItem}–{lastItem}</span>
        {' of '}
        <span className="font-medium text-slate-700 dark:text-slate-200">{totalArticles}</span> articles
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage <= 1}
            aria-label="Previous page"
          >
            ←
          </button>

          {pageItems(currentPage, totalPages).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="px-2 text-slate-400 select-none" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
                className={
                  item === currentPage
                    ? 'px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : navButton
                }
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage >= totalPages}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      )}
    </nav>
  );
}
