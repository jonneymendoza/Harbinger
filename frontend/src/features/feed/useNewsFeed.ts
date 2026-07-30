'use client';

import useSWR from 'swr';
import { NewsListResponse, Article } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082/api';

async function fetcher(url: string): Promise<NewsListResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch news');
  const json = await res.json();
  // API wraps response in { success, data, error } - unwrap it
  return json?.data ?? json;
}

export const FEED_PAGE_SIZE = 20;

export function useNewsFeed(page: number = 1, limit: number = FEED_PAGE_SIZE) {
  const url = `${API_URL}/news?page=${page}&limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR<NewsListResponse>(url, fetcher, {
    // Keep the previous page visible while the next one loads, so paging does
    // not flash the whole grid back to skeletons.
    keepPreviousData: true,
  });

  return {
    articles: data?.articles ?? [],
    totalArticles: data?.totalArticles ?? 0,
    currentPage: data?.currentPage ?? page,
    pageSize: data?.pageSize ?? limit,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export async function fetchArticleById(id: string): Promise<Article | null> {
  try {
    const res = await fetch(`${API_URL}/news/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}
