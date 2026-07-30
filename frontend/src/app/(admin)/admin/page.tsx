'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/ui';
import { AdminGuard } from '@/features/admin/ui/AdminGuard';
import { SourcesTable } from '@/features/admin/ui/SourcesTable';
import { SourceEditor } from '@/features/admin/ui/SourceEditor';
import { useAdapters, useSources, runScraper } from '@/features/admin/api/useSources';
import { dismissToast, showError, showSuccess, startLoading } from '@/features/ui/toast';
import {
  Source,
  SourceFormValues,
  emptySourceForm,
  sourceToForm,
} from '@/features/admin/types';

function Dashboard() {
  const { adapters, defaultAdapter, isLoading: adaptersLoading } = useAdapters();
  const { sources, isLoading, isError, error, create, update, remove, toggleActive, refresh } =
    useSources();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormValues>(emptySourceForm());
  const [scraping, setScraping] = useState(false);

  const openCreate = () => {
    setForm(emptySourceForm(defaultAdapter));
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = (source: Source) => {
    setForm(sourceToForm(source));
    setEditingId(source._id);
    setEditorOpen(true);
  };

  const handleSave = async (requiresSelectors: boolean) => {
    // Errors propagate to SourceEditor, which shows them beside the form the
    // operator is still looking at.
    if (editingId) {
      await update(editingId, form, requiresSelectors);
      showSuccess('Source updated');
    } else {
      await create(form, requiresSelectors);
      showSuccess('Source added', 'It will be picked up on the next scrape.');
    }
    setEditorOpen(false);
    setEditingId(null);
  };

  const guarded = async (fn: () => Promise<void>, okText: string) => {
    try {
      await fn();
      showSuccess(okText);
    } catch (err) {
      showError('Action failed', err instanceof Error ? err.message : undefined);
    }
  };

  const handleRunScraper = async () => {
    setScraping(true);
    // A scrape can run for minutes, so hold a loading toast rather than leaving
    // the operator wondering whether anything is happening.
    const toastId = startLoading('Running scraper…');
    try {
      await runScraper();
      await refresh();
      showSuccess('Scrape finished', 'New articles are on the feed.');
    } catch (err) {
      showError('Scrape failed', err instanceof Error ? err.message : undefined);
    } finally {
      dismissToast(toastId);
      setScraping(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sources</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Scraping targets for the hourly job.{' '}
            <Link href="/admin/logs" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Scrape logs
            </Link>
            {' · '}
            <Link href="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
              View feed
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRunScraper} disabled={scraping}>
            {scraping ? 'Scraping…' : 'Run scraper now'}
          </Button>
          <Button onClick={openCreate} disabled={adaptersLoading}>
            Add source
          </Button>
        </div>
      </header>

      {editorOpen && (
        <div className="mb-6">
          <SourceEditor
            adapters={adapters}
            values={form}
            onChange={setForm}
            onSave={handleSave}
            onCancel={() => {
              setEditorOpen(false);
              setEditingId(null);
            }}
            editingId={editingId}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          Could not load sources{error?.message ? `: ${error.message}` : '.'}
        </div>
      ) : (
        <SourcesTable
          sources={sources}
          adapters={adapters}
          onEdit={openEdit}
          onToggle={(id) => guarded(() => toggleActive(id), 'Source status updated.')}
          onDelete={(id) => guarded(() => remove(id), 'Source deleted.')}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}
