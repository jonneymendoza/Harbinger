/**
 * Guards the storage semantics of BookmarkRepository.
 *
 * The regression these exist for: `add`/`remove` originally reported success
 * from `updateOne().modifiedCount`. The User schema sets `timestamps: true`, so
 * Mongoose appends updatedAt to every update and modifiedCount is 1 whenever
 * the document matched — even when $addToSet or $pull changed nothing. Deleting
 * the same bookmark twice therefore returned 200 instead of 404.
 *
 * Both mutations must decide via the query filter instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const userModel = {
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  findById: vi.fn(),
};

const articleModel = {
  find: vi.fn(),
  countDocuments: vi.fn(),
  exists: vi.fn(),
};

vi.mock('@domains/auth/models/User', () => ({ User: userModel }));
vi.mock('@domains/news/models/Article', () => ({ default: articleModel }));

const { BookmarkRepository } = await import('../../src/infrastructure/repositories/bookmarkRepository');

const USER_ID = '507f1f77bcf86cd799439011';
const ARTICLE_ID = '607f1f77bcf86cd7994390a1';

let repo: InstanceType<typeof BookmarkRepository>;

beforeEach(() => {
  vi.clearAllMocks();
  repo = new BookmarkRepository();
});

describe('BookmarkRepository.add', () => {
  it('scopes the filter to "bookmark absent" so a repeat add is detectable', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });

    await repo.add(USER_ID, ARTICLE_ID);

    const [filter, update] = userModel.findOneAndUpdate.mock.calls[0];
    expect(String(filter._id)).toBe(USER_ID);
    // The $ne clause is what makes a no-op distinguishable from a real insert.
    expect(filter.bookmarks).toHaveProperty('$ne');
    expect(String(filter.bookmarks.$ne)).toBe(ARTICLE_ID);
    expect(update).toHaveProperty('$addToSet');
  });

  it('returns true when the bookmark was added', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });
    await expect(repo.add(USER_ID, ARTICLE_ID)).resolves.toBe(true);
  });

  it('returns false when it was already bookmarked', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null);
    await expect(repo.add(USER_ID, ARTICLE_ID)).resolves.toBe(false);
  });

  it('never infers success from modifiedCount', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null);
    await repo.add(USER_ID, ARTICLE_ID);
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('BookmarkRepository.remove', () => {
  it('scopes the filter to "bookmark present" so a repeat delete is detectable', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });

    await repo.remove(USER_ID, ARTICLE_ID);

    const [filter, update] = userModel.findOneAndUpdate.mock.calls[0];
    expect(String(filter._id)).toBe(USER_ID);
    expect(String(filter.bookmarks)).toBe(ARTICLE_ID);
    expect(update).toHaveProperty('$pull');
  });

  it('returns true when a bookmark was removed', async () => {
    userModel.findOneAndUpdate.mockResolvedValue({ _id: USER_ID });
    await expect(repo.remove(USER_ID, ARTICLE_ID)).resolves.toBe(true);
  });

  it('returns false when nothing was bookmarked — the 404 path', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null);
    await expect(repo.remove(USER_ID, ARTICLE_ID)).resolves.toBe(false);
  });

  it('never infers success from modifiedCount', async () => {
    userModel.findOneAndUpdate.mockResolvedValue(null);
    await repo.remove(USER_ID, ARTICLE_ID);
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('BookmarkRepository.findByUser', () => {
  const leanChain = (result: unknown) => {
    const chain: any = {
      sort: vi.fn(() => chain),
      skip: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      populate: vi.fn(() => chain),
      lean: vi.fn(async () => result),
    };
    return chain;
  };

  it('short-circuits without querying articles when the user has none', async () => {
    userModel.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ bookmarks: [] }) }),
    });

    await expect(repo.findByUser(USER_ID, 1, 20)).resolves.toEqual({
      articles: [],
      totalArticles: 0,
    });
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('counts matching articles, not the raw id list', async () => {
    // Two ids bookmarked but only one article still exists.
    userModel.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ bookmarks: [ARTICLE_ID, '607f1f77bcf86cd7994390a2'] }) }),
    });
    articleModel.find.mockReturnValue(
      leanChain([
        {
          _id: ARTICLE_ID,
          title: 'Kept',
          thumbnailImage: null,
          summary: 's',
          publishedAt: new Date('2026-07-01T00:00:00.000Z'),
          sourceId: { name: 'Src' },
        },
      ]),
    );
    articleModel.countDocuments.mockResolvedValue(1);

    const page = await repo.findByUser(USER_ID, 1, 20);

    // A bookmark whose article was deleted must not inflate the total.
    expect(page.totalArticles).toBe(1);
    expect(page.articles).toHaveLength(1);
    expect(page.articles[0]).toMatchObject({ id: ARTICLE_ID, sourceName: 'Src' });
  });

  it('paginates through skip/limit', async () => {
    userModel.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ bookmarks: [ARTICLE_ID] }) }),
    });
    const chain = leanChain([]);
    articleModel.find.mockReturnValue(chain);
    articleModel.countDocuments.mockResolvedValue(0);

    await repo.findByUser(USER_ID, 3, 10);

    expect(chain.skip).toHaveBeenCalledWith(20);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('falls back to the denormalised source name', async () => {
    userModel.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ bookmarks: [ARTICLE_ID] }) }),
    });
    articleModel.find.mockReturnValue(
      leanChain([
        {
          _id: ARTICLE_ID,
          title: 'T',
          summary: '',
          publishedAt: new Date(),
          sourceId: null,
          sourceName: 'Stored Name',
        },
      ]),
    );
    articleModel.countDocuments.mockResolvedValue(1);

    const page = await repo.findByUser(USER_ID, 1, 20);
    expect(page.articles[0].sourceName).toBe('Stored Name');
  });
});

describe('BookmarkRepository.articleExists', () => {
  it('is true when the article is present', async () => {
    articleModel.exists.mockResolvedValue({ _id: ARTICLE_ID });
    await expect(repo.articleExists(ARTICLE_ID)).resolves.toBe(true);
  });

  it('is false when absent', async () => {
    articleModel.exists.mockResolvedValue(null);
    await expect(repo.articleExists(ARTICLE_ID)).resolves.toBe(false);
  });
});
