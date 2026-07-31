'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { api } from '@/shared/api/client';
import {
  Adapter,
  AdaptersResponse,
  FeedDiscoveryResult,
  ScrapeRunSourceResult,
  Source,
  SourceFormValues,
  TestScrapeResult,
} from '../types';

const SOURCES_KEY = '/admin/sources';
const ADAPTERS_KEY = '/admin/sources/adapters';

/** Turns the form's string fields into the payload the API expects. */
function toPayload(values: SourceFormValues, requiresSelectors: boolean) {
  const limit = parseInt(values.articleLimit, 10);

  return {
    name: values.name.trim(),
    displayName: values.displayName.trim() || values.name.trim(),
    baseUrl: values.baseUrl.trim(),
    adapter: values.adapter,
    // Omitted rather than sent as null, so the source falls back to the
    // global SCRAPER_ARTICLE_LIMIT.
    ...(Number.isFinite(limit) && limit > 0 ? { articleLimit: limit } : {}),
    // Selectors are meaningless to site-specific adapters; sending stale ones
    // would leave confusing values on the document.
    articleLinkSelector: requiresSelectors ? values.articleLinkSelector.trim() : '',
    contentSelector: requiresSelectors ? values.contentSelector.trim() : '',
    titleSelector: requiresSelectors ? values.titleSelector.trim() : '',
    imageSelector: requiresSelectors ? values.imageSelector.trim() : '',
    isActive: values.isActive,
  };
}

export function useAdapters() {
  const { data, error, isLoading } = useSWR<AdaptersResponse>(
    ADAPTERS_KEY,
    async (path: string) => {
      const res = await api.auth.get<AdaptersResponse>(path);
      if (!res.success || !res.data) throw new Error(res.error?.message || 'Failed to load adapters');
      return res.data;
    },
    { revalidateOnFocus: false },
  );

  return {
    adapters: data?.adapters ?? [],
    defaultAdapter: data?.defaultAdapter ?? 'generic',
    isLoading,
    isError: !!error,
  };
}

export function useSources() {
  const { data, error, isLoading, mutate } = useSWR<Source[]>(SOURCES_KEY, async (path: string) => {
    const res = await api.auth.get<Source[]>(path);
    if (!res.success) throw new Error(res.error?.message || 'Failed to load sources');
    return res.data ?? [];
  });

  // Returns the new id so the caller can scrape the source straight away
  // instead of waiting for the next run over every source.
  const create = useCallback(
    async (values: SourceFormValues, requiresSelectors: boolean): Promise<string | null> => {
      const res = await api.auth.post<{ insertedId: string }>(
        SOURCES_KEY,
        toPayload(values, requiresSelectors),
      );
      if (!res.success) throw new Error(res.error?.message || 'Failed to create source');
      await mutate();
      return res.data?.insertedId ?? null;
    },
    [mutate],
  );

  const update = useCallback(
    async (id: string, values: SourceFormValues, requiresSelectors: boolean) => {
      const res = await api.auth.put(`${SOURCES_KEY}/${id}`, toPayload(values, requiresSelectors));
      if (!res.success) throw new Error(res.error?.message || 'Failed to update source');
      await mutate();
    },
    [mutate],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await api.auth.delete(`${SOURCES_KEY}/${id}`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to delete source');
      await mutate();
    },
    [mutate],
  );

  const toggleActive = useCallback(
    async (id: string) => {
      const res = await api.auth.patch(`${SOURCES_KEY}/${id}/toggle`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to toggle source');
      await mutate();
    },
    [mutate],
  );

  return {
    sources: data ?? [],
    isLoading,
    isError: !!error,
    error: error as Error | undefined,
    refresh: mutate,
    create,
    update,
    remove,
    toggleActive,
  };
}

/**
 * Dry-runs a scrape against one URL. This is the loop that stops broken
 * selectors reaching the hourly cron (specs/admin-panel.md §3.C).
 */
export async function testScrape(
  url: string,
  values: SourceFormValues,
  requiresSelectors: boolean,
): Promise<TestScrapeResult> {
  const res = await api.auth.post<TestScrapeResult>('/admin/sources/test', {
    url,
    name: values.name || 'Test Source',
    adapter: values.adapter,
    // The RSS adapter resolves the item against this feed.
    baseUrl: values.baseUrl,
    ...(requiresSelectors
      ? {
          articleLinkSelector: values.articleLinkSelector,
          contentSelector: values.contentSelector,
          titleSelector: values.titleSelector,
          imageSelector: values.imageSelector,
        }
      : {}),
  });

  if (!res.success || !res.data) {
    throw new Error(res.error?.message || 'Test scrape failed');
  }
  return res.data;
}

/**
 * Probes a site for feeds and sitemaps. Results are offered for the operator to
 * choose from rather than applied automatically — most sites publish several,
 * and picking one silently would hide why a source carries what it does.
 */
export async function discoverFeeds(url: string): Promise<FeedDiscoveryResult> {
  const res = await api.auth.get<FeedDiscoveryResult>(
    `/admin/sources/discover-feeds?url=${encodeURIComponent(url)}`,
  );
  if (!res.success || !res.data) {
    throw new Error(res.error?.message || 'Feed lookup failed');
  }
  return res.data;
}

/**
 * Runs every active source. Returns each source's counts so the completion
 * toast can say what actually happened, rather than just "finished".
 */
export async function runScraper(): Promise<ScrapeRunSourceResult[]> {
  const res = await api.auth.post<ScrapeRunSourceResult[]>('/admin/sources/run-scraper', {});
  if (!res.success) throw new Error(res.error?.message || 'Failed to run scraper');
  return res.data ?? [];
}

/**
 * Scrapes one source immediately. Used by the per-row "Scrape now" button and
 * run automatically after a source is added — a full run takes minutes, nearly
 * all of it on sources that have nothing new.
 */
export async function scrapeSource(id: string): Promise<ScrapeRunSourceResult> {
  const res = await api.auth.post<ScrapeRunSourceResult>(`${SOURCES_KEY}/${id}/scrape`, {});
  if (!res.success || !res.data) {
    throw new Error(res.error?.message || 'Failed to scrape source');
  }
  return res.data;
}

/**
 * Turns a result into the sentence the toast shows. Zero new articles is a
 * normal outcome on a source already up to date, so it reads as success — but
 * discovering no links at all is how a broken adapter presents, and says so.
 */
export function describeScrapeResult(
  result: ScrapeRunSourceResult,
  /**
   * What to call the source. The result carries the canonical `name` — which
   * is what belongs in the scrape log — but the admin chose a display name and
   * expects to see that, so the caller passes it when it knows it.
   */
  label = result.sourceName,
): {
  ok: boolean;
  message: string;
  detail: string;
} {
  const { articlesScraped, articlesSkipped, articlesRejected, linksDiscovered, errors } = result;

  if (errors.length > 0) {
    return { ok: false, message: `${label} failed`, detail: errors[0] };
  }

  if (linksDiscovered === 0) {
    return {
      ok: false,
      message: `${label} found no articles`,
      detail: 'The adapter discovered no links. Check the configuration or try a feed instead.',
    };
  }

  const parts = [`${articlesSkipped} already stored`];
  if (articlesRejected > 0) parts.push(`${articlesRejected} not articles`);

  return {
    ok: true,
    message:
      articlesScraped > 0
        ? `${label}: ${articlesScraped} new article${articlesScraped === 1 ? '' : 's'}`
        : `${label} is up to date`,
    detail: `${linksDiscovered} link${linksDiscovered === 1 ? '' : 's'} checked, ${parts.join(', ')}.`,
  };
}

export function findAdapter(adapters: Adapter[], key: string): Adapter | undefined {
  return adapters.find((a) => a.key === key);
}
