import { vi } from 'vitest';

/**
 * Minimal stand-ins for the Mongoose query chains the news routes use.
 *
 * `news.route.ts` reaches for the models directly, so testing its HTTP contract
 * means faking the chain rather than injecting a repository.
 */

/** Resolves a `find().sort().skip().limit().populate().lean()` chain. */
export function findChain<T>(result: T[]) {
  const chain: any = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    populate: vi.fn(() => chain),
    lean: vi.fn(async () => result),
  };
  return chain;
}

/** Resolves a `findById().populate().lean()` chain. */
export function findByIdChain<T>(result: T | null) {
  const chain: any = {
    populate: vi.fn(() => chain),
    lean: vi.fn(async () => result),
  };
  return chain;
}

export function articleDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: overrides._id ?? '607f1f77bcf86cd7994390a1',
    title: 'A title',
    thumbnailImage: 'https://example.com/thumb.jpg',
    heroImage: 'https://example.com/hero.jpg',
    contentImages: [],
    fullContent: '<p>Body</p>',
    summary: 'A summary.',
    sourceUrl: 'https://example.com/article',
    sourceName: 'Fallback Source',
    category: 'News',
    publishedAt: new Date('2026-07-01T00:00:00.000Z'),
    scrapedAt: new Date('2026-07-02T00:00:00.000Z'),
    sourceId: { name: 'Test Source' },
    ...overrides,
  };
}
