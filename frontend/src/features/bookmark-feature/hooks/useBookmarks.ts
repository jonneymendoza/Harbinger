'use client';

import { useBookmarksContext } from '../lib/BookmarksContext';

/**
 * Bookmark state and actions.
 *
 * Thin wrapper over BookmarksContext, which holds the set above the router so it
 * survives client-side navigation. This used to own a local `useState(new Set())`
 * per consumer, which started empty and was never hydrated — so bookmarking an
 * article and navigating away lost the indicator.
 */
export function useBookmarks() {
  return useBookmarksContext();
}
