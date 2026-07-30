'use client';

import useSWR from 'swr';
import { api } from '@/shared/api/client';
import { ScrapeRunPage } from '../types';

/**
 * Recent scrape runs. Refreshes on an interval so a log left open during a
 * manual run shows the result without a reload.
 */
export function useScrapeRuns(page: number, limit = 20) {
  const key = `/admin/sources/scrape-runs?page=${page}&limit=${limit}`;

  const { data, error, isLoading, mutate } = useSWR<ScrapeRunPage>(
    key,
    async (path: string) => {
      const res = await api.auth.get<ScrapeRunPage>(path);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to load scrape runs');
      }
      return res.data;
    },
    { refreshInterval: 30_000, keepPreviousData: true },
  );

  return {
    runs: data?.runs ?? [],
    totalRuns: data?.totalRuns ?? 0,
    currentPage: data?.currentPage ?? page,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isError: !!error,
    error: error as Error | undefined,
    refresh: mutate,
  };
}
