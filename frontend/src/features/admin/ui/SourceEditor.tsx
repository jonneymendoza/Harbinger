'use client';

import { useMemo, useState } from 'react';
import { Button, Input } from '@/shared/ui';
import { Adapter, SourceFormValues, TestScrapeResult } from '../types';
import { findAdapter, testScrape } from '../api/useSources';

interface SourceEditorProps {
  adapters: Adapter[];
  values: SourceFormValues;
  onChange: (values: SourceFormValues) => void;
  onSave: (requiresSelectors: boolean) => Promise<void>;
  onCancel: () => void;
  /** Null when creating. */
  editingId: string | null;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SourceEditor({
  adapters,
  values,
  onChange,
  onSave,
  onCancel,
  editingId,
}: SourceEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestScrapeResult | null>(null);
  const [touched, setTouched] = useState(false);

  const adapter = findAdapter(adapters, values.adapter);
  const requiresSelectors = adapter?.requiresSelectors ?? true;

  const set = <K extends keyof SourceFormValues>(key: K, value: SourceFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const errors = useMemo(() => {
    const e: Partial<Record<keyof SourceFormValues, string>> = {};
    if (!values.name.trim()) e.name = 'Required';
    if (!values.baseUrl.trim()) e.baseUrl = 'Required';
    else if (!isValidUrl(values.baseUrl.trim())) e.baseUrl = 'Must be a valid http(s) URL';

    if (values.articleLimit) {
      const n = Number(values.articleLimit);
      if (!Number.isInteger(n) || n < 1 || n > 200) e.articleLimit = 'Whole number, 1–200';
    }

    // Only the selector-driven adapter needs these.
    if (requiresSelectors) {
      if (!values.articleLinkSelector.trim()) e.articleLinkSelector = 'Required for this adapter';
      if (!values.contentSelector.trim()) e.contentSelector = 'Required for this adapter';
    }
    return e;
  }, [values, requiresSelectors]);

  const hasErrors = Object.keys(errors).length > 0;
  const show = (key: keyof SourceFormValues) => (touched ? errors[key] : undefined);

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(requiresSelectors);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const url = testUrl.trim();
    if (!isValidUrl(url)) {
      setTestError('Enter a full article URL to test against');
      setTestResult(null);
      return;
    }

    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      setTestResult(await testScrape(url, values, requiresSelectors));
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test scrape failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        {editingId ? 'Edit source' : 'Add a source'}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          error={show('name')}
          hint="Internal identifier, e.g. “Arsenal News”"
          placeholder="Arsenal News"
        />
        <Input
          label="Display name"
          value={values.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          hint="Shown on the feed filter. Defaults to Name."
          placeholder="Arsenal"
        />
      </div>

      <div className="mt-4">
        <Input
          label="Base URL"
          required
          value={values.baseUrl}
          onChange={(e) => set('baseUrl', e.target.value)}
          error={show('baseUrl')}
          hint="The listing page the scraper starts from"
          placeholder="https://example.com/news"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="adapter-select"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Adapter<span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            id="adapter-select"
            value={values.adapter}
            onChange={(e) => set('adapter', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {adapters.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          {adapter && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{adapter.description}</p>
          )}
        </div>

        <Input
          label="Article limit"
          type="number"
          min={1}
          max={200}
          value={values.articleLimit}
          onChange={(e) => set('articleLimit', e.target.value)}
          error={show('articleLimit')}
          hint="Newest articles considered per run. Blank uses the global default."
          placeholder="20"
        />
      </div>

      {requiresSelectors ? (
        <fieldset className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            CSS selectors
          </legend>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Used by the generic adapter to find content. Test before saving — broken selectors
            silently return nothing on the hourly run.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Article link"
              required
              value={values.articleLinkSelector}
              onChange={(e) => set('articleLinkSelector', e.target.value)}
              error={show('articleLinkSelector')}
              placeholder="a.article-card"
            />
            <Input
              label="Main content body"
              required
              value={values.contentSelector}
              onChange={(e) => set('contentSelector', e.target.value)}
              error={show('contentSelector')}
              placeholder=".post-body"
            />
            <Input
              label="Page title"
              value={values.titleSelector}
              onChange={(e) => set('titleSelector', e.target.value)}
              hint="Falls back to og:title, then h1"
              placeholder="h1"
            />
            <Input
              label="Hero image"
              value={values.imageSelector}
              onChange={(e) => set('imageSelector', e.target.value)}
              hint="Falls back to og:image"
              placeholder="img.hero"
            />
          </div>
        </fieldset>
      ) : (
        <p className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          The <strong>{adapter?.label}</strong> adapter knows this site’s structure, so no CSS
          selectors are needed.
        </p>
      )}

      {/* Live Test — specs/admin-panel.md §3.C */}
      <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Test scrape</h4>
        <p className="mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
          Runs this configuration against one article URL and shows what would be stored.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              error={testError ?? undefined}
              placeholder="https://example.com/news/some-article"
              aria-label="Article URL to test"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={testing}
            className="sm:mt-0"
          >
            {testing ? 'Testing…' : 'Test scrape'}
          </Button>
        </div>

        {testResult && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Preview
            </p>
            <div className="flex gap-3">
              {testResult.heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={testResult.heroImage}
                  alt=""
                  className="h-20 w-32 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-white">
                  {testResult.title || <span className="text-red-600">No title found</span>}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {testResult.summary || 'No summary extracted'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  {testResult.fullContent.length.toLocaleString()} chars ·{' '}
                  {testResult.contentImages.length} image(s)
                  {testResult.category ? ` · ${testResult.category}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-slate-600"
        />
        Active — include in the hourly scrape
      </label>

      {saveError && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}
      {touched && hasErrors && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          Fix the highlighted fields before saving.
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add source'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
