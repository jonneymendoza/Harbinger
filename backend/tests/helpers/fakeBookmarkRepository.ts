import {
  BookmarkPage,
  BookmarkedArticle,
  IBookmarkRepository,
} from '../../src/domains/bookmarks/interfaces/IBookmarkRepository';

/**
 * In-memory IBookmarkRepository for route tests.
 *
 * Lets the suite assert the HTTP contract — paths, status codes, response
 * shape, auth — without a Mongo instance.
 */
export class FakeBookmarkRepository implements IBookmarkRepository {
  /** userId -> ordered article ids */
  private byUser = new Map<string, string[]>();
  /** articleId -> article */
  private articles = new Map<string, BookmarkedArticle>();

  seedArticle(id: string, overrides: Partial<BookmarkedArticle> = {}): BookmarkedArticle {
    const article: BookmarkedArticle = {
      id,
      title: overrides.title ?? `Article ${id}`,
      thumbnailImage: overrides.thumbnailImage ?? `https://example.com/${id}.jpg`,
      summary: overrides.summary ?? 'A summary.',
      publishedAt: overrides.publishedAt ?? new Date('2026-07-01T00:00:00.000Z'),
      sourceName: overrides.sourceName ?? 'Test Source',
    };
    this.articles.set(id, article);
    return article;
  }

  seedBookmarks(userId: string, articleIds: string[]): void {
    articleIds.forEach((id) => {
      if (!this.articles.has(id)) this.seedArticle(id);
    });
    this.byUser.set(userId, [...articleIds]);
  }

  async findByUser(userId: string, page: number, limit: number): Promise<BookmarkPage> {
    // Only ids that still resolve to an article count, matching the real
    // repository's join semantics.
    const resolved = (this.byUser.get(userId) ?? [])
      .map((id) => this.articles.get(id))
      .filter((a): a is BookmarkedArticle => a !== undefined)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    return {
      totalArticles: resolved.length,
      articles: resolved.slice((page - 1) * limit, (page - 1) * limit + limit),
    };
  }

  async articleExists(articleId: string): Promise<boolean> {
    return this.articles.has(articleId);
  }

  async add(userId: string, articleId: string): Promise<boolean> {
    const current = this.byUser.get(userId) ?? [];
    if (current.includes(articleId)) return false;
    this.byUser.set(userId, [...current, articleId]);
    return true;
  }

  async remove(userId: string, articleId: string): Promise<boolean> {
    const current = this.byUser.get(userId) ?? [];
    if (!current.includes(articleId)) return false;
    this.byUser.set(
      userId,
      current.filter((id) => id !== articleId),
    );
    return true;
  }

  async clear(userId: string): Promise<void> {
    this.byUser.set(userId, []);
  }

  async listIds(userId: string): Promise<string[]> {
    return [...(this.byUser.get(userId) ?? [])];
  }
}
