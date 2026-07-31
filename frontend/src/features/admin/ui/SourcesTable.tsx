'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import { Adapter, Source } from '../types';
import { findAdapter } from '../api/useSources';

interface SourcesTableProps {
  sources: Source[];
  adapters: Adapter[];
  onEdit: (source: Source) => void;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onScrape: (source: Source) => Promise<void>;
  /** Set while any scrape is running: they share a lock, so all rows wait. */
  scrapeLocked?: boolean;
}

export function SourcesTable({
  sources,
  adapters,
  onEdit,
  onToggle,
  onDelete,
  onScrape,
  scrapeLocked = false,
}: SourcesTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  // Delete is irreversible, so it takes a second click to confirm.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  };

  const scrape = async (source: Source) => {
    setScrapingId(source._id);
    try {
      await onScrape(source);
    } finally {
      setScrapingId(null);
    }
  };

  if (sources.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No sources configured yet. Add one to start scraping.
      </p>
    );
  }

  return (
    // Wide tables scroll inside their own container rather than the page.
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Name</th>
            <th scope="col" className="px-4 py-3 font-medium">Base URL</th>
            <th scope="col" className="px-4 py-3 font-medium">Adapter</th>
            <th scope="col" className="px-4 py-3 font-medium">Limit</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Added</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {sources.map((source) => {
            const adapter = findAdapter(adapters, source.adapter);
            const busy = busyId === source._id;

            return (
              <tr key={source._id} className="bg-white dark:bg-slate-900/40">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900 dark:text-white">{source.name}</span>
                  {source.displayName && source.displayName !== source.name && (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      shown as “{source.displayName}”
                    </span>
                  )}
                </td>
                <td className="max-w-[16rem] px-4 py-3">
                  <a
                    href={source.baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {source.baseUrl}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {adapter?.label ?? source.adapter ?? 'generic'}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">
                  {source.articleLimit ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      source.isActive
                        ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${source.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                    />
                    {source.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {/* Scrapes this source alone. A run over every source takes
                        minutes; this returns as soon as one is done. */}
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => scrape(source)}
                      disabled={busy || scrapeLocked}
                      title={
                        scrapeLocked && scrapingId !== source._id
                          ? 'Another scrape is running'
                          : `Fetch new articles from ${source.displayName || source.name} now`
                      }
                    >
                      {scrapingId === source._id ? 'Scraping…' : 'Scrape now'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => onEdit(source)}
                      disabled={busy}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => act(source._id, () => onToggle(source._id))}
                      disabled={busy}
                    >
                      {source.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    {confirmingId === source._id ? (
                      <Button
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        onClick={() => act(source._id, () => onDelete(source._id))}
                        disabled={busy}
                      >
                        {busy ? 'Deleting…' : 'Confirm'}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        onClick={() => setConfirmingId(source._id)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
