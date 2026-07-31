'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import { SourcesTable } from '@/features/admin/ui/SourcesTable';
import { SourceEditor } from '@/features/admin/ui/SourceEditor';
import {
  useAdapters,
  useSources,
  runScraper,
  scrapeSource,
  describeScrapeResult,
} from '@/features/admin/api/useSources';
import { dismissToast, showError, showSuccess, showWarning, startLoading } from '@/features/ui/toast';
import {
  ScrapeRunSourceResult,
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
      setEditorOpen(false);
      setEditingId(null);
      return;
    }

    const newId = await create(form, requiresSelectors);
    setEditorOpen(false);
    setEditingId(null);

    // Fetch the new source straight away. Waiting for the hourly run — or a
    // manual run over every source — meant adding a source and then finding an
    // unchanged feed, which reads as the source having failed.
    if (newId) {
      showSuccess('Source added', 'Fetching its articles now…');
      await runSourceScrape(newId, form.displayName.trim() || form.name.trim());
    } else {
      showSuccess('Source added', 'It will be picked up on the next scrape.');
    }
  };

  const guarded = async (fn: () => Promise<void>, okText: string) => {
    try {
      await fn();
      showSuccess(okText);
    } catch (err) {
      showError('Action failed', err instanceof Error ? err.message : undefined);
    }
  };

  /** Scrapes one source and reports what it actually found. */
  const runSourceScrape = async (id: string, label: string) => {
    setScraping(true);
    const toastId = startLoading(`Scraping ${label}…`);
    try {
      const outcome = describeScrapeResult(await scrapeSource(id), label);
      await refresh();
      if (outcome.ok) showSuccess(outcome.message, outcome.detail);
      else showWarning(outcome.message, outcome.detail);
    } catch (err) {
      showError(`Could not scrape ${label}`, err instanceof Error ? err.message : undefined);
    } finally {
      dismissToast(toastId);
      setScraping(false);
    }
  };

  /** Summarises a full run: totals, plus which sources had a problem. */
  const summarise = (results: ScrapeRunSourceResult[]) => {
    const added = results.reduce((sum, r) => sum + r.articlesScraped, 0);
    const degraded = results.filter((r) => r.errors.length > 0 || r.linksDiscovered === 0);

    // Results carry the canonical name; the admin knows sources by the display
    // name shown in the table, so name them that way here too.
    const labelFor = (r: ScrapeRunSourceResult) =>
      sources.find((s) => s._id === r.sourceId)?.displayName || r.sourceName;

    const detail = [
      `${results.length} source${results.length === 1 ? '' : 's'} checked`,
      degraded.length > 0 ? `${degraded.map(labelFor).join(', ')} had problems` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      ok: degraded.length === 0,
      message:
        added > 0
          ? `Scrape finished — ${added} new article${added === 1 ? '' : 's'}`
          : 'Scrape finished — everything already up to date',
      detail,
    };
  };

  const handleRunScraper = async () => {
    setScraping(true);
    // A scrape can run for minutes, so hold a loading toast rather than leaving
    // the operator wondering whether anything is happening.
    const toastId = startLoading('Running scraper…');
    try {
      const outcome = summarise(await runScraper());
      await refresh();
      // Counts rather than "New articles are on the feed" — that claim was
      // made whether or not anything had been added.
      if (outcome.ok) showSuccess(outcome.message, outcome.detail);
      else showWarning(outcome.message, outcome.detail);
    } catch (err) {
      showError('Scrape failed', err instanceof Error ? err.message : undefined);
    } finally {
      dismissToast(toastId);
      setScraping(false);
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sources</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Scraping targets for the hourly job.
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
          onScrape={(source) => runSourceScrape(source._id, source.displayName || source.name)}
          scrapeLocked={scraping}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return <Dashboard />;
}
