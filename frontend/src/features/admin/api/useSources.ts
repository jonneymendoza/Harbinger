'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { api } from '@/shared/api/client';
import {
  Adapter,
  AdaptersResponse,
  FeedDiscoveryResult,
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

  const create = useCallback(
    async (values: SourceFormValues, requiresSelectors: boolean) => {
      const res = await api.auth.post(SOURCES_KEY, toPayload(values, requiresSelectors));
      if (!res.success) throw new Error(res.error?.message || 'Failed to create source');
      await mutate();
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
 * Probes a site for RSS/Atom feeds. Results are offered for the operator to
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

export async function runScraper(): Promise<unknown> {
  const res = await api.auth.post('/admin/sources/run-scraper', {});
  if (!res.success) throw new Error(res.error?.message || 'Failed to run scraper');
  return res.data;
}

export function findAdapter(adapters: Adapter[], key: string): Adapter | undefined {
  return adapters.find((a) => a.key === key);
}
