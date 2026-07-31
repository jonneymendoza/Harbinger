'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/lib/AuthContext';
import { useBookmarks } from '@/features/bookmark-feature/hooks/useBookmarks';
import { Article } from '@/features/feed/types';
import { api } from '@/shared/api/client';

/** Cards per page. The backend clamps `limit` to 100. */
const PAGE_SIZE = 24;

interface BookmarkFeedPage {
  articles: Article[];
  totalArticles: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export default function BookmarksPage() {
  const { status } = useAuth();
  const { bookmarkedIds, loadingStates, toggleBookmark, loadBookmarks } = useBookmarks();

  /* -- state -- */
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Distinguishes "request failed" from "loaded, genuinely empty" — the old
  // silent return made those look identical.
  const [loadError, setLoadError] = useState<string | null>(null);

  /* -- fetch bookmarked articles (paginated backend) -- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== 'IS_AUTHENTICATED' && status !== 'IS_GUEST') return;

      setIsLoading(true);

      // Go through the shared client: it prefixes NEXT_PUBLIC_API_URL, attaches
      // the token, and unwraps the { success, data, error } envelope. A bare
      // `/api/bookmarks` is relative, so it resolved to the Next.js server on
      // :3300 rather than the API on :8082 and always 404'd — which this page
      // swallowed, leaving a permanent "No bookmarks yet".
      const res = await api.auth.get<BookmarkFeedPage>(
        `/bookmarks?page=${page}&limit=${PAGE_SIZE}`,
      );
      if (cancelled) return;

      if (!res.success || !res.data) {
        setLoadError(res.error?.message || 'Could not load your bookmarks.');
        setArticles([]);
        setTotalArticles(0);
        setIsLoading(false);
        return;
      }

      setLoadError(null);
      setArticles(res.data.articles ?? []);
      setTotalPages(res.data.totalPages ?? 1);
      setTotalArticles(res.data.totalArticles ?? 0);
      setIsLoading(false);

      /* Load the IDs in parallel so feed-page bookmark buttons stay in sync. */
      void loadBookmarks();
    }

    void load();
    return () => { cancelled = true; };
  }, [status, page]); // re-fetch when auth status or pagination changes

  /* -- actions -- */

  async function onRemoveBookmark(articleId: string) {
    const result = await toggleBookmark(articleId);
    if (!result.success || result.action !== 'removed') return;

    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    setTotalArticles((t) => Math.max(0, t - 1));
  }

  /* -- guard: guest gets a sign-in CTA -- */

  if (status === 'IS_GUEST') {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
            Sign in to view bookmarks
          </h2>
          <p className="mb-6 text-slate-500 dark:text-slate-400">
            Create an account or sign in to save and manage your bookmarked articles.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  /* -- anonymous: no bookmarks page for unauthenticated visitors -- */

  if (status === 'IS_ANONYMOUS') {
    return (
      <main className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
            Please sign in to view bookmarks
          </h2>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  /* -- page (logged-in user) -- */

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Bookmarks</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {totalArticles > 0
            ? `${totalArticles} article${totalArticles === 1 ? '' : 's'} saved`
            : 'No bookmarks yet. Start saving articles you want to revisit.'}
        </p>
      </header>

      {loadError && !isLoading && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* Skeleton loaders — only while the fetch is in flight */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : totalArticles > 0 ? (
        /* -- Grid: show bookmarked articles -- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Next 13+ renders the anchor itself; a nested <a> is a hard error. */}
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/article/${article.id}`}
              className="group block h-full relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all"
            >
                {/* Bookmark pin (red = active bookmark) */}
                <button
                  type="button"
                  disabled={loadingStates.get(article.id) ?? false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveBookmark(article.id);
                  }}
                  className="z-10 absolute top-3 right-3 p-2 rounded-full bg-white dark:bg-slate-900 shadow-md transition-all hover:scale-110 disabled:cursor-wait"
                  style={{ color: bookmarkedIds.has(article.id) ? '#ef4444' : '' }}
                  title="Remove bookmark"
                  aria-label={`Unbookmark ${article.title}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarkedIds.has(article.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </button>

                {/* Thumbnail */}
                {article.thumbnailImage ? (
                  <img
                    src={article.thumbnailImage}
                    alt={article.title}
                    className="aspect-video w-full bg-slate-100 dark:bg-slate-700 rounded-t-xl group-hover:scale-[1.02] transition-transform duration-300 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-video w-full bg-slate-100 dark:bg-slate-700 rounded-t-xl group-hover:scale-[1.02] transition-transform duration-300" />
                )}

                {/* Content */}
                <div className="p-4 flex flex-col h-full">
                  <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-2 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 flex-1">{article.summary}</p>

                  {/* Meta strip */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{article.sourceName}</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                </div>
            </Link>
          ))}
        </div>
      ) : (
        /* -- Empty state: page loaded but no bookmarks exist -- */
        <div className="flex flex-col items-center py-20 text-slate-400 dark:text-slate-500">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="mb-4 opacity-60">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <h2 className="text-lg font-medium text-slate-600 dark:text-slate-400">No bookmarks yet</h2>
          <p className="mt-1">Browsing articles? Click the bookmark icon on any card to save it here.</p>
        </div>
      )}

      {/* Pagination — only when there are multiple pages of results */}
      {totalPages > 1 && (
        <nav aria-label="Bookmarks pagination" className="mt-10 flex items-center justify-center gap-2">
          {/* Previous */}
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page of bookmarks"
          >
            ←
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const offset = totalPages <= 7 ? 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
            if (offset < 1 || offset > totalPages) return null;
            return (
              <button
                key={offset}
                onClick={() => setPage(offset)}
                disabled={offset === page}
                aria-current={offset === page ? 'page' : undefined}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                  offset === page
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                } disabled:cursor-not-allowed`}
              >
                {offset}
              </button>
            );
          })}

          {/* Next */}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page of bookmarks"
          >
            →
          </button>
        </nav>
      )}
    </main>
  );
}
