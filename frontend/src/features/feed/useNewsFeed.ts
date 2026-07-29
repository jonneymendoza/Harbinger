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

export function useNewsFeed(page: number = 1, limit: number = 20) {
  const url = `${API_URL}/news?page=${page}&limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR<NewsListResponse>(url, fetcher);

  return {
    articles: data?.articles ?? [],
    totalArticles: data?.totalArticles ?? 0,
    currentPage: data?.currentPage ?? page,
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
