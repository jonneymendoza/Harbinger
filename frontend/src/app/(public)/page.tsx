'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/lib/AuthContext';
import { Button, Card } from '@/shared/ui';
import Link from 'next/link';
import { useNewsFeed, useFeedSources, FEED_PAGE_SIZE } from '@/features/feed/useNewsFeed';
import { Pagination } from '@/features/feed/ui/Pagination';
import { SourceFilter } from '@/features/feed/ui/SourceFilter';
import { Article } from '@/features/feed/types';
import { api } from '@/shared/api/client';

export default function PublicPage() {
  const { status, isAuthenticated, isGuest, setGuestToken, triggerUpgradePrompt } = useAuth();
  const [page, setPage] = useState(1);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { sources, totalArticles: allSourcesTotal } = useFeedSources();
  const { articles, isLoading, isError, currentPage, totalPages, totalArticles, pageSize } =
    useNewsFeed(page, FEED_PAGE_SIZE, sourceId);

  /** Track per-article bookmark states locally for instant UI feedback */
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loadingBookmark, setLoadingBookmark] = useState<string | null>(null);

  /** Issue a guest JWT and transition the user to guest mode */
  const handleGuestLogin = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082/api';
      const res = await fetch(`${apiUrl}/auth/guest`, { method: 'POST' });
      const { data } = await res.json();
      if (data?.token) {
        setGuestToken(data.token);
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  /** Bookmark handler — POST/DELETE /api/bookmarks based on auth state */
  const handleBookmark = useCallback(async (articleId: string) => {
    // Guest upgrade path per guest-mode.md spec
    if (isGuest || !isAuthenticated) {
      triggerUpgradePrompt();
      return;
    }

    setLoadingBookmark(articleId);
    const isBookmarked = bookmarkedIds.has(articleId);

    try {
      let success = false;

      if (isBookmarked) {
        // Remove bookmark — DELETE /api/bookmarks/:articleId
        const response = await api.auth.delete(`/bookmarks/${articleId}`);
        if (response.error?.code === 'GUEST_UPGRADE_REQUIRED') {
          triggerUpgradePrompt();
          return;
        }
        success = response.success;
      } else {
        // Add bookmark — POST /api/bookmarks/:articleId
        // POST /api/bookmarks takes the id in the body, per specs/api-endpoints.md §4
        const response = await api.auth.post('/bookmarks', { articleId });
        if (response.error?.code === 'GUEST_UPGRADE_REQUIRED') {
          triggerUpgradePrompt();
          return;
        }
        success = response.success;
      }

      if (success) {
        setBookmarkedIds(prev => {
          const next = new Set(prev);
          if (isBookmarked) next.delete(articleId);
          else next.add(articleId);
          return next;
        });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('[Page] Bookmark action failed:', e.message || err);
    } finally {
      setLoadingBookmark(null);
    }
  }, [isGuest, isAuthenticated, bookmarkedIds, triggerUpgradePrompt]);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      {/* -- Hero / CTA section — always shown on first visit -- */}
      {status === 'IS_ANONYMOUS' && (
        <section className="flex flex-col items-center justify-center py-16 px-6 text-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
          <div className="max-w-xl w-full">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Harbinger</h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              Your personalized news aggregation platform. Explore curated content from your favorite gaming and community sources.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/login" className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors font-medium">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-8h4l4 4m-4-4 4-4"/></svg>
                Login
              </Link>
              <button
                onClick={handleGuestLogin}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </section>
      )}

      {/* -- Feed grid — always rendered -- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8" style={{ minHeight: isAuthenticated || isGuest ? undefined : 0 }}>
        {/* Anonymous visitors browse the same feed as everyone else — gating it
            behind a session left them staring at a permanent loading state. */}
        <h2 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">Latest Articles</h2>

        <SourceFilter
          sources={sources}
          selectedId={sourceId}
          totalArticles={allSourcesTotal}
          disabled={isLoading}
          onSelect={(next) => {
            setSourceId(next);
            // Page 4 of "All" may not exist once filtered to one source.
            setPage(1);
          }}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">Failed to load articles. Please try again later.</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-600">No articles found. Check back later!</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {articles.map((article: Article) => (
              <Link key={article.id} href={`/article/${article.id}`} passHref>
                <Card hover className="group h-full flex flex-col relative">
                  {/* Bookmark button — fills/empties based on local bookmarkedIds state */}
                  <button
                    disabled={loadingBookmark === article.id}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBookmark(article.id); }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed"
                    style={{ color: bookmarkedIds.has(article.id) ? '#ef4444' : '' }}
                    title="Bookmark this article"                      >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </button>
                  {article.thumbnailImage ? (
                    <img src={article.thumbnailImage} alt={article.title} className="aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg group-hover:scale-[1.02] transition-transform object-cover" />
                  ) : (
                    <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg group-hover:scale-[1.02] transition-transform" />
                  )}
                  <div className="flex-1 p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{article.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{article.summary}</p>
                  </div>
                  <div className="px-4 pb-4 flex items-center justify-between text-xs text-slate-400">
                    <span>{article.sourceName}</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalArticles={totalArticles}
            pageSize={pageSize}
            disabled={isLoading}
            onPageChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </section>
    </main>
  );
}
