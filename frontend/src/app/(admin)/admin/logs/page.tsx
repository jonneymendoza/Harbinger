'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/ui';
import { AdminGuard } from '@/features/admin/ui/AdminGuard';
import { useScrapeRuns } from '@/features/admin/api/useScrapeRuns';
import { ScrapeRun, ScrapeRunSourceResult, ScrapeStatus } from '@/features/admin/types';

const STATUS_STYLES: Record<ScrapeStatus, string> = {
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const STATUS_DOT: Record<ScrapeStatus, string> = {
  success: 'bg-emerald-500',
  partial: 'bg-amber-500',
  failed: 'bg-red-500',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${Math.round(seconds % 60)}s`;
}

/** A source is worth flagging if it errored, or found nothing at all. */
function isDegraded(r: ScrapeRunSourceResult): boolean {
  return r.errors.length > 0 || r.linksDiscovered === 0;
}

function RunRow({ run }: { run: ScrapeRun }) {
  const [open, setOpen] = useState(false);
  const degraded = run.results.filter(isDegraded).length;

  return (
    <>
      <tr className="bg-white dark:bg-slate-900/40">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-left font-medium text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
          >
            {new Date(run.startedAt).toLocaleString()}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {run.trigger}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status]}`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[run.status]}`} />
            {run.status}
          </span>
        </td>
        <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">
          {formatDuration(run.durationMs)}
        </td>
        <td className="px-4 py-3 tabular-nums font-medium text-slate-900 dark:text-white">
          {run.totalArticlesAdded}
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          {run.results.length} source{run.results.length === 1 ? '' : 's'}
          {degraded > 0 && (
            <span className="ml-1 text-amber-700 dark:text-amber-400">
              {/* amber-600 on white is only 3.2:1; amber-700 clears AA. */}· {degraded} needing
              attention
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Details'}
          </Button>
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50 dark:bg-slate-800/40">
          <td colSpan={7} className="px-4 py-4">
            {run.error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                Pipeline error: {run.error}
              </p>
            )}

            {run.results.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No sources ran. Check that at least one source is active.
              </p>
            ) : (
              <ul className="space-y-2">
                {run.results.map((r) => (
                  <li
                    key={r.sourceName}
                    className={`rounded-lg border px-3 py-2 ${
                      isDegraded(r)
                        ? 'border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{r.sourceName}</span>
                      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {r.linksDiscovered} discovered · {r.articlesScraped} added ·{' '}
                        {r.articlesSkipped} already had · {r.articlesRejected} not articles
                      </span>
                    </div>

                    {/* Zero links is the shape a silently broken adapter takes;
                        it raises no error of its own, so call it out. */}
                    {r.linksDiscovered === 0 && r.errors.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        Discovered nothing — the site’s markup may have changed.
                      </p>
                    )}

                    {r.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.errors.slice(0, 5).map((err, i) => (
                          <li key={i} className="text-xs text-red-600 dark:text-red-400">
                            {err}
                          </li>
                        ))}
                        {r.errors.length > 5 && (
                          <li className="text-xs text-slate-500">
                            …and {r.errors.length - 5} more
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Logs() {
  const [page, setPage] = useState(1);
  const { runs, totalRuns, totalPages, isLoading, isError, error, refresh } = useScrapeRuns(page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scrape logs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {totalRuns > 0 ? `${totalRuns} run${totalRuns === 1 ? '' : 's'} recorded. ` : ''}
            <Link href="/admin" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Back to sources
            </Link>
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>
      </header>

      {isLoading && runs.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          Could not load scrape logs{error?.message ? `: ${error.message}` : '.'}
        </div>
      ) : runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No scrape runs recorded yet. They appear here after the next scheduled run,
          or once you use “Run scraper now”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Started</th>
                <th scope="col" className="px-4 py-3 font-medium">Trigger</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                <th scope="col" className="px-4 py-3 font-medium">Added</th>
                <th scope="col" className="px-4 py-3 font-medium">Sources</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Scrape log pagination" className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <AdminGuard>
      <Logs />
    </AdminGuard>
  );
}
