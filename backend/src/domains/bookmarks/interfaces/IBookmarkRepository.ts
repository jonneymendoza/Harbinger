import { Types } from 'mongoose';

/** An article as it appears in a bookmark listing (no body — lists stay light). */
export interface BookmarkedArticle {
  id: string;
  title: string;
  thumbnailImage: string | null;
  summary: string;
  publishedAt: Date;
  sourceName: string;
}

export interface BookmarkPage {
  articles: BookmarkedArticle[];
  totalArticles: number;
}

export interface IBookmarkRepository {
  /** Bookmarked articles for a user, newest first. */
  findByUser(userId: string, page: number, limit: number): Promise<BookmarkPage>;

  /** True when the article exists. */
  articleExists(articleId: string): Promise<boolean>;

  /** Adds a bookmark. Idempotent; returns false when it was already present. */
  add(userId: string, articleId: string): Promise<boolean>;

  /** Removes a bookmark. Returns false when it was not bookmarked. */
  remove(userId: string, articleId: string): Promise<boolean>;

  /** Clears every bookmark for a user. */
  clear(userId: string): Promise<void>;

  /** Article ids the user has bookmarked, for hydrating UI state. */
  listIds(userId: string): Promise<string[]>;
}

/** Narrow helper so callers need not import mongoose to validate input. */
export function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
