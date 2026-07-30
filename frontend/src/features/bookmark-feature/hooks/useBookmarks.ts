'use client';

import { useState, useCallback } from 'react';
import { api } from '@/shared/api/client';
import { useAuth } from '@/features/auth/lib/AuthContext';
import { Article } from '@/features/feed/types';

interface BookmarkState {
  bookmarkedIds: Set<string>;
  loadingStates: Map<string, boolean>;
}

/**
 * Hook for managing article bookmarks.
 * Supports both registered users and guest users (upgrade prompt).
 */
export function useBookmarks() {
  const [state, setState] = useState<BookmarkState>({
    bookmarkedIds: new Set(),
    loadingStates: new Map(),
  });

  const { isAuthenticated, isGuest, triggerUpgradePrompt } = useAuth();

  /** Fetch all bookmarks and populate the local state */
  const loadBookmarks = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Only the ids are needed to mark cards; GET /bookmarks returns a
      // paginated envelope of full articles, which would both be the wrong
      // shape here and miss anything past the first page.
      const response = await api.auth.get<{ ids: string[] }>('/bookmarks/ids');
      if (response.success && Array.isArray(response.data?.ids)) {
        setState(prev => ({ ...prev, bookmarkedIds: new Set(response.data!.ids) }));
      }
    } catch {
      // Silently fail — user can retry
    }
  }, [isAuthenticated]);

  /** Toggle bookmark for a specific article */
  const toggleBookmark = useCallback(async (articleId: string): Promise<{ success: boolean; action?: 'bookmarked' | 'removed'; upgradeNeeded?: boolean }> => {
    // Set loading state
    setState(prev => ({
      ...prev,
      loadingStates: new Map(prev.loadingStates).set(articleId, true),
    }));

    try {
      const isBookmarked = state.bookmarkedIds.has(articleId);

      if (isAuthenticated && !isGuest) {
        if (isBookmarked) {
          // Remove bookmark — DELETE /api/bookmarks/:articleId
          const response = await api.auth.delete<{ bookmarkRemoved: boolean }>(`/bookmarks/${articleId}`);
          
          if (response.success) {
            setState(prev => ({
              ...prev,
              bookmarkedIds: new Set(Array.from(prev.bookmarkedIds).filter(id => id !== articleId)),
              loadingStates: new Map(prev.loadingStates).set(articleId, false),
            }));
            return { success: true, action: 'removed' };
          }
          
          if (response.error?.code === 'GUEST_UPGRADE_REQUIRED') {
            triggerUpgradePrompt();
            setState(prev => ({
              ...prev,
              loadingStates: new Map(prev.loadingStates).set(articleId, false),
            }));
            return { success: false, upgradeNeeded: true };
          }

          throw new Error(response.error?.message || 'Failed to remove bookmark');
        } else {
          // Add bookmark — POST /api/bookmarks with { articleId } in the body
          const response = await api.auth.post<BookmarkResult>('/bookmarks', { articleId });
          
          if (response.success) {
            setState(prev => ({
              ...prev,
              bookmarkedIds: new Set([...prev.bookmarkedIds, articleId]),
              loadingStates: new Map(prev.loadingStates).set(articleId, false),
            }));
            return { success: true, action: 'bookmarked' };
          }

          if (response.error?.code === 'GUEST_UPGRADE_REQUIRED') {
            triggerUpgradePrompt();
            setState(prev => ({
              ...prev,
              loadingStates: new Map(prev.loadingStates).set(articleId, false),
            }));
            return { success: false, upgradeNeeded: true };
          }

          throw new Error(response.error?.message || 'Failed to bookmark article');
        }
      } else if (isGuest) {
        // Guest cannot bookmark — show upgrade prompt
        triggerUpgradePrompt();
        setState(prev => ({
          ...prev,
          loadingStates: new Map(prev.loadingStates).set(articleId, false),
        }));
        return { success: false, upgradeNeeded: true };
      }
    } catch {
      // On any error, restore old state
      setState(prev => ({
        ...prev,
        loadingStates: new Map(prev.loadingStates).set(articleId, false),
      }));
    }

    return { success: false };
  }, [state.bookmarkedIds, isAuthenticated, isGuest, triggerUpgradePrompt]);

  return {
    bookmarkedIds: state.bookmarkedIds,
    loadingStates: state.loadingStates,
    toggleBookmark,
    loadBookmarks,
  };
}

interface BookmarkResult {
  bookmarked: boolean;
  error?: { message: string; code: string };
}
