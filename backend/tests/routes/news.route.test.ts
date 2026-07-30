/**
 * Contract tests for the public news endpoints (specs/api-endpoints.md §3, §6).
 *
 * Covers the guards added around pagination and the source filter: an
 * unbounded limit could read the whole collection, a negative page produced a
 * skip Mongo rejects, and an unrecognised source silently returned the
 * unfiltered feed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { findChain, findByIdChain, articleDoc } from '../helpers/mockModel';

const articleModel = {
  find: vi.fn(),
  countDocuments: vi.fn(),
  findById: vi.fn(),
  aggregate: vi.fn(),
};

const sourceModel = {
  find: vi.fn(),
};

vi.mock('@domains/news/models/Article', () => ({ default: articleModel }));
vi.mock('@domains/news/models/Source', () => ({ default: sourceModel }));

const { default: newsRouter } = await import('../../src/domains/news/routes/news.route');
const { errorHandler, notFoundHandler } = await import('../../src/shared/errors/errorHandler');

const VALID_ID = '607f1f77bcf86cd7994390a1';
const SOURCE_ID = '507f1f77bcf86cd799439055';

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();

  articleModel.find.mockReturnValue(findChain([articleDoc()]));
  articleModel.countDocuments.mockResolvedValue(1);
  articleModel.findById.mockReturnValue(findByIdChain(articleDoc()));
  articleModel.aggregate.mockResolvedValue([]);
  sourceModel.find.mockReturnValue({ sort: () => ({ lean: async () => [] }) });

  app = express();
  app.use(express.json());
  app.use('/api/news', newsRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
});

describe('GET /api/news', () => {
  it('returns the documented envelope and list item shape', async () => {
    const res = await request(app).get('/api/news');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, error: null });
    expect(res.body.data).toMatchObject({
      totalArticles: 1,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(Object.keys(res.body.data.articles[0]).sort()).toEqual(
      ['id', 'publishedAt', 'sourceName', 'summary', 'thumbnailImage', 'title'].sort(),
    );
  });

  it('prefers the populated source name over the denormalised copy', async () => {
    const res = await request(app).get('/api/news');
    expect(res.body.data.articles[0].sourceName).toBe('Test Source');
  });

  it('falls back to the stored sourceName when the source was deleted', async () => {
    articleModel.find.mockReturnValue(findChain([articleDoc({ sourceId: null })]));
    const res = await request(app).get('/api/news');
    expect(res.body.data.articles[0].sourceName).toBe('Fallback Source');
  });

  it('defaults to page 1 with 20 per page', async () => {
    await request(app).get('/api/news');
    const chain = articleModel.find.mock.results[0].value;
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it('applies page and limit', async () => {
    await request(app).get('/api/news?page=3&limit=10');
    const chain = articleModel.find.mock.results[0].value;
    expect(chain.skip).toHaveBeenCalledWith(20);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('never issues a negative skip for a negative page', async () => {
    const res = await request(app).get('/api/news?page=-5');
    const chain = articleModel.find.mock.results[0].value;

    expect(res.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(res.body.data.currentPage).toBe(1);
  });

  it('caps limit at 100 so one request cannot read the collection', async () => {
    const res = await request(app).get('/api/news?limit=99999');
    const chain = articleModel.find.mock.results[0].value;

    expect(chain.limit).toHaveBeenCalledWith(100);
    expect(res.body.data.pageSize).toBe(100);
  });

  it('falls back to defaults for non-numeric paging values', async () => {
    const res = await request(app).get('/api/news?page=abc&limit=xyz');
    expect(res.body.data.currentPage).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
  });

  it('reports totalPages as 1 when the feed is empty', async () => {
    articleModel.find.mockReturnValue(findChain([]));
    articleModel.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/news');
    expect(res.body.data.totalArticles).toBe(0);
    expect(res.body.data.totalPages).toBe(1);
  });

  it('filters by source id', async () => {
    await request(app).get(`/api/news?source=${SOURCE_ID}`);

    const filter = articleModel.find.mock.calls[0][0];
    expect(String(filter.sourceId)).toBe(SOURCE_ID);
    // The count has to use the same filter or totalPages would describe the
    // unfiltered feed.
    expect(String(articleModel.countDocuments.mock.calls[0][0].sourceId)).toBe(SOURCE_ID);
  });

  it('rejects an unrecognised source rather than returning everything', async () => {
    const res = await request(app).get('/api/news?source=not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('treats an empty source param as unfiltered', async () => {
    const res = await request(app).get('/api/news?source=');
    expect(res.status).toBe(200);
    expect(articleModel.find.mock.calls[0][0]).toEqual({});
  });
});

describe('GET /api/news/:id', () => {
  it('returns every documented field, including summary and sourceName', async () => {
    const res = await request(app).get(`/api/news/${VALID_ID}`);

    expect(res.status).toBe(200);
    // summary and sourceName were previously omitted, which left media-only
    // articles blank and rendered "View on undefined".
    expect(res.body.data).toMatchObject({
      id: VALID_ID,
      title: 'A title',
      summary: 'A summary.',
      sourceName: 'Test Source',
      heroImage: 'https://example.com/hero.jpg',
      fullContent: '<p>Body</p>',
      sourceUrl: 'https://example.com/article',
      category: 'News',
    });
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/news/nope');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(articleModel.findById).not.toHaveBeenCalled();
  });

  it('returns 404 when the article does not exist', async () => {
    articleModel.findById.mockReturnValue(findByIdChain(null));

    const res = await request(app).get(`/api/news/${VALID_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('surfaces a database fault as 500 in the standard envelope', async () => {
    articleModel.findById.mockImplementation(() => {
      throw new Error('mongo is down');
    });

    const res = await request(app).get(`/api/news/${VALID_ID}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, data: null });
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('GET /api/news/sources', () => {
  it('is not captured by the /:id route', async () => {
    const res = await request(app).get('/api/news/sources');

    expect(res.status).toBe(200);
    expect(articleModel.findById).not.toHaveBeenCalled();
    expect(res.body.data).toHaveProperty('sources');
  });

  it('returns label and count per source, using displayName when present', async () => {
    sourceModel.find.mockReturnValue({
      sort: () => ({
        lean: async () => [
          { _id: SOURCE_ID, name: 'RSI Comm-Link', displayName: 'Star Citizen News' },
        ],
      }),
    });
    articleModel.aggregate.mockResolvedValue([{ _id: SOURCE_ID, count: 7 }]);
    articleModel.countDocuments.mockResolvedValue(7);

    const res = await request(app).get('/api/news/sources');

    expect(res.body.data.sources).toEqual([
      { id: SOURCE_ID, name: 'RSI Comm-Link', label: 'Star Citizen News', articleCount: 7 },
    ]);
    expect(res.body.data.totalArticles).toBe(7);
  });

  it('falls back to name when displayName is unset', async () => {
    sourceModel.find.mockReturnValue({
      sort: () => ({ lean: async () => [{ _id: SOURCE_ID, name: 'Arsenal News' }] }),
    });
    articleModel.aggregate.mockResolvedValue([{ _id: SOURCE_ID, count: 3 }]);

    const res = await request(app).get('/api/news/sources');
    expect(res.body.data.sources[0].label).toBe('Arsenal News');
  });

  it('omits sources with no articles, which would filter to an empty feed', async () => {
    sourceModel.find.mockReturnValue({
      sort: () => ({
        lean: async () => [
          { _id: SOURCE_ID, name: 'Has articles' },
          { _id: '507f1f77bcf86cd799439066', name: 'Nothing scraped yet' },
        ],
      }),
    });
    articleModel.aggregate.mockResolvedValue([{ _id: SOURCE_ID, count: 2 }]);

    const res = await request(app).get('/api/news/sources');

    expect(res.body.data.sources).toHaveLength(1);
    expect(res.body.data.sources[0].name).toBe('Has articles');
  });
});

describe('unmatched /api routes', () => {
  it('return the standard 404 envelope rather than HTML', async () => {
    const res = await request(app).get('/api/news/../nope').redirects(0);
    expect(res.body.success ?? false).toBe(false);
  });
});
