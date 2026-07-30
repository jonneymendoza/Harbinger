'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/shared/api/client';
import { useAuth } from '@/features/auth/lib/AuthContext';

export interface ToggleResult {
  success: boolean;
  action?: 'bookmarked' | 'removed';
  upgradeNeeded?: boolean;
}

interface BookmarksContextValue {
  bookmarkedIds: Set<string>;
  loadingStates: Map<string, boolean>;
  isBookmarked: (articleId: string) => boolean;
  isPending: (articleId: string) => boolean;
  toggleBookmark: (articleId: string) => Promise<ToggleResult>;
  loadBookmarks: () => Promise<void>;
  /** False until the first load settles, so the UI can avoid flashing "not bookmarked". */
  hydrated: boolean;
}

const BookmarksContext = createContext<BookmarksContextValue | undefined>(undefined);

/**
 * Single source of truth for which articles the signed-in user has bookmarked.
 *
 * Previously each page kept its own `useState(new Set())` that started empty and
 * was never hydrated, so bookmarking an article and navigating away lost the
 * indicator entirely. Holding the set above the router means it survives
 * client-side navigation and every surface agrees.
 */
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isGuest, triggerUpgradePrompt } = useAuth();

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(new Map());
  const [hydrated, setHydrated] = useState(false);

  const loadBookmarks = useCallback(async () => {
    // Guests cannot bookmark, so there is nothing to fetch.
    if (!isAuthenticated || isGuest) {
      setBookmarkedIds(new Set());
      setHydrated(true);
      return;
    }

    try {
      const res = await api.auth.get<{ ids: string[] }>('/bookmarks/ids');
      if (res.success && Array.isArray(res.data?.ids)) {
        setBookmarkedIds(new Set(res.data.ids));
      }
    } catch {
      // Leave whatever we had; a failed refresh should not wipe the indicators.
    } finally {
      setHydrated(true);
    }
  }, [isAuthenticated, isGuest]);

  // Re-runs when the session changes, so signing in or out re-syncs.
  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  const setPending = (articleId: string, pending: boolean) =>
    setLoadingStates((prev) => {
      const next = new Map(prev);
      if (pending) next.set(articleId, true);
      else next.delete(articleId);
      return next;
    });

  const toggleBookmark = useCallback(
    async (articleId: string): Promise<ToggleResult> => {
      if (isGuest || !isAuthenticated) {
        triggerUpgradePrompt();
        return { success: false, upgradeNeeded: true };
      }

      const wasBookmarked = bookmarkedIds.has(articleId);
      setPending(articleId, true);

      try {
        const res = wasBookmarked
          ? await api.auth.delete(`/bookmarks/${articleId}`)
          : await api.auth.post('/bookmarks', { articleId });

        if (res.error?.code === 'GUEST_UPGRADE_REQUIRED') {
          triggerUpgradePrompt();
          return { success: false, upgradeNeeded: true };
        }

        if (!res.success) {
          return { success: false };
        }

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (wasBookmarked) next.delete(articleId);
          else next.add(articleId);
          return next;
        });

        return { success: true, action: wasBookmarked ? 'removed' : 'bookmarked' };
      } catch {
        return { success: false };
      } finally {
        setPending(articleId, false);
      }
    },
    [bookmarkedIds, isAuthenticated, isGuest, triggerUpgradePrompt],
  );

  const value = useMemo<BookmarksContextValue>(
    () => ({
      bookmarkedIds,
      loadingStates,
      isBookmarked: (id: string) => bookmarkedIds.has(id),
      isPending: (id: string) => loadingStates.get(id) ?? false,
      toggleBookmark,
      loadBookmarks,
      hydrated,
    }),
    [bookmarkedIds, loadingStates, toggleBookmark, loadBookmarks, hydrated],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarksContext(): BookmarksContextValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarksContext must be used within a BookmarksProvider');
  return ctx;
}
