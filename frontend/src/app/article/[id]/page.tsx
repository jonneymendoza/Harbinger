'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Article } from '@/features/feed/types';
import { fetchArticleById } from '@/features/feed/useNewsFeed';
import { useAuth } from '@/features/auth/lib/AuthContext';
import { useBookmarks } from '@/features/bookmark-feature/hooks/useBookmarks';

interface ArticlePageProps {
  params: Promise<{ id: string }>;
}

function ArticleContent({ id }: { id: string }) {
  const { isAuthenticated, isGuest } = useAuth();
  // Read from the shared set rather than assuming false — opening an article
  // already saved used to show it as unbookmarked.
  const { isBookmarked, isPending, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(id);
  const bookmarkLoading = isPending(id);

  // Keyed on the article id and resolved through the feed feature's client, so
  // the API base URL is defined in exactly one place.
  const { data: article, isLoading } = useSWR<Article | null>(
    ['article', id],
    () => fetchArticleById(id),
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="space-y-3">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-full" />
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Article not found</h1>
        <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">← Back to Feed</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
          Back to Feed
        </Link>

        {/* Hero image */}
        {article.heroImage && (
          <div className="mb-6 rounded-xl overflow-hidden">
            <img
              src={article.heroImage}
              alt={article.title}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Article header */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium">{article.sourceName}</span>
            <span>•</span>
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        </header>

        {/* Article content */}
        <article className="prose prose-slate dark:prose-invert max-w-none">
          {article.fullContent ? (
            <div dangerouslySetInnerHTML={{ __html: article.fullContent }} />
          ) : (
            <p className="text-slate-600 dark:text-slate-400">{article.summary}</p>
          )}
        </article>

        {/* Content images */}
        {article.contentImages && article.contentImages.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {article.contentImages.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`Content image ${index + 1}`}
                className="w-full h-auto rounded-lg"
              />
            ))}
          </div>
        )}

        {/* Source link */}
        {article.sourceUrl && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Original source:{' '}
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View on {article.sourceName} →
              </a>
            </p>
          </div>
        )}

        {/* Bookmark toggle — Phase 4 implementation */}
        <div className="mt-8 flex items-center gap-4">
          <button
            disabled={bookmarkLoading}
            // The context owns the request, the guest-upgrade prompt and the
            // pending flag, so every surface stays in step.
            onClick={() => void toggleBookmark(article.id)}
            aria-pressed={bookmarked}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 transition-all disabled:cursor-not-allowed"
            style={{ color: bookmarked ? '#ef4444' : '' }}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this article'}                      >
            {bookmarkLoading ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            )}
          </button>
          {isGuest && isAuthenticated === false ? null : (
            <span className="text-sm text-slate-400">{bookmarked ? '★ Bookmarked' : '☆ Save for later'}</span>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ArticlePage({ params }: ArticlePageProps) {
  // This file is a Client Component, so the params promise is unwrapped with
  // use() — an `async` client component never hydrates, leaving the page stuck
  // on its loading skeleton.
  const { id } = use(params);
  return <ArticleContent id={id} />;
}
