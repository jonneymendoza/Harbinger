/**
 * Contract tests for /api/bookmarks (specs/api-endpoints.md §4 and §6).
 *
 * Every defect these replaced was a contract defect — wrong mount path, 403
 * where the error map says 401, a bare array where a paginated envelope was
 * specified — so the assertions here are deliberately about status codes and
 * response shape rather than storage behaviour.
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { TEST_JWT_SECRET } from '../helpers/tokens';

// jwtService captures JWT_SECRET at import time.
process.env.JWT_SECRET = TEST_JWT_SECRET;

let createBookmarkRouter: typeof import('../../src/domains/bookmarks/routes/bookmark.route')['createBookmarkRouter'];
let errorHandler: typeof import('../../src/shared/errors/errorHandler')['errorHandler'];
let notFoundHandler: typeof import('../../src/shared/errors/errorHandler')['notFoundHandler'];
let bearer: typeof import('../helpers/tokens')['bearer'];
let bearerWithBadSignature: typeof import('../helpers/tokens')['bearerWithBadSignature'];
let bearerExpired: typeof import('../helpers/tokens')['bearerExpired'];
let FakeBookmarkRepository: typeof import('../helpers/fakeBookmarkRepository')['FakeBookmarkRepository'];

beforeAll(async () => {
  ({ createBookmarkRouter } = await import('../../src/domains/bookmarks/routes/bookmark.route'));
  ({ errorHandler, notFoundHandler } = await import('../../src/shared/errors/errorHandler'));
  ({ bearer, bearerWithBadSignature, bearerExpired } = await import('../helpers/tokens'));
  ({ FakeBookmarkRepository } = await import('../helpers/fakeBookmarkRepository'));
});

const USER_ID = '507f1f77bcf86cd799439011';
const ARTICLE_A = '607f1f77bcf86cd7994390a1';
const ARTICLE_B = '607f1f77bcf86cd7994390a2';
const ABSENT_ARTICLE = '607f1f77bcf86cd7994390ff';

let repo: InstanceType<typeof FakeBookmarkRepository>;
let app: Express;

beforeEach(() => {
  repo = new FakeBookmarkRepository();
  repo.seedArticle(ARTICLE_A, { publishedAt: new Date('2026-07-02T00:00:00.000Z') });
  repo.seedArticle(ARTICLE_B, { publishedAt: new Date('2026-07-01T00:00:00.000Z') });

  app = express();
  app.use(express.json());
  app.use('/api/bookmarks', createBookmarkRouter(repo));
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
});

describe('bookmarks — authentication (spec §6 error map)', () => {
  const cases: Array<[string, () => request.Test]> = [
    ['GET /', () => request(app).get('/api/bookmarks')],
    ['POST /', () => request(app).post('/api/bookmarks').send({ articleId: ARTICLE_A })],
    ['DELETE /:id', () => request(app).delete(`/api/bookmarks/${ARTICLE_A}`)],
    ['DELETE /', () => request(app).delete('/api/bookmarks')],
    ['GET /ids', () => request(app).get('/api/bookmarks/ids')],
  ];

  it.each(cases)('%s returns 401 UNAUTHORIZED without a token', async (_label, call) => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('returns 401 for a token signed with the wrong key', async () => {
    const res = await request(app).get('/api/bookmarks').set('Authorization', bearerWithBadSignature());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an expired token', async () => {
    const res = await request(app).get('/api/bookmarks').set('Authorization', bearerExpired());
    expect(res.status).toBe(401);
  });

  it('returns 401 when the header is not a Bearer scheme', async () => {
    const res = await request(app).get('/api/bookmarks').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  // The distinction the old implementation collapsed: authenticated but not
  // permitted is 403, not 401.
  it.each(cases)('%s returns 403 FORBIDDEN for a GUEST token', async (_label, call) => {
    const res = await call().set('Authorization', bearer({ sub: USER_ID, role: 'GUEST', email: null }));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows ADMIN as well as USER', async () => {
    const res = await request(app)
      .get('/api/bookmarks')
      .set('Authorization', bearer({ sub: USER_ID, role: 'ADMIN' }));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/bookmarks', () => {
  const auth = () => bearer({ sub: USER_ID, role: 'USER' });

  it('returns the paginated envelope from spec §3, not a bare array', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A, ARTICLE_B]);

    const res = await request(app).get('/api/bookmarks').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(false);
    expect(res.body.data).toMatchObject({
      totalArticles: 2,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(res.body.data.articles).toHaveLength(2);
  });

  it('exposes id (not _id) and omits article bodies from the listing', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A]);

    const res = await request(app).get('/api/bookmarks').set('Authorization', auth());
    const article = res.body.data.articles[0];

    expect(Object.keys(article).sort()).toEqual(
      ['id', 'publishedAt', 'sourceName', 'summary', 'thumbnailImage', 'title'].sort(),
    );
    expect(article).not.toHaveProperty('_id');
    expect(article).not.toHaveProperty('__v');
    expect(article).not.toHaveProperty('fullContent');
  });

  it('returns an empty page rather than 404 when nothing is bookmarked', async () => {
    const res = await request(app).get('/api/bookmarks').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.articles).toEqual([]);
    expect(res.body.data.totalArticles).toBe(0);
    // An empty feed still reads as page 1 of 1.
    expect(res.body.data.totalPages).toBe(1);
  });

  it('sorts newest first', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_B, ARTICLE_A]);

    const res = await request(app).get('/api/bookmarks').set('Authorization', auth());
    expect(res.body.data.articles.map((a: any) => a.id)).toEqual([ARTICLE_A, ARTICLE_B]);
  });

  it('paginates', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A, ARTICLE_B]);

    const page1 = await request(app).get('/api/bookmarks?page=1&limit=1').set('Authorization', auth());
    const page2 = await request(app).get('/api/bookmarks?page=2&limit=1').set('Authorization', auth());

    expect(page1.body.data.articles.map((a: any) => a.id)).toEqual([ARTICLE_A]);
    expect(page2.body.data.articles.map((a: any) => a.id)).toEqual([ARTICLE_B]);
    expect(page1.body.data.totalPages).toBe(2);
  });

  it('clamps a negative page and an oversized limit', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A]);

    const res = await request(app)
      .get('/api/bookmarks?page=-5&limit=99999')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data.currentPage).toBe(1);
    expect(res.body.data.pageSize).toBe(100);
  });

  it('keeps one user\'s bookmarks out of another\'s list', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A]);
    repo.seedBookmarks('507f1f77bcf86cd799439099', [ARTICLE_B]);

    const res = await request(app).get('/api/bookmarks').set('Authorization', auth());
    expect(res.body.data.articles.map((a: any) => a.id)).toEqual([ARTICLE_A]);
  });
});

describe('POST /api/bookmarks', () => {
  const auth = () => bearer({ sub: USER_ID, role: 'USER' });

  it('takes articleId in the body (spec §4) and returns 201', async () => {
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth())
      .send({ articleId: ARTICLE_A });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, error: null });
    expect(res.body.data).toMatchObject({ articleId: ARTICLE_A, bookmarked: true });
    await expect(repo.listIds(USER_ID)).resolves.toEqual([ARTICLE_A]);
  });

  it('is idempotent — bookmarking twice succeeds and does not duplicate', async () => {
    await request(app).post('/api/bookmarks').set('Authorization', auth()).send({ articleId: ARTICLE_A });
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth())
      .send({ articleId: ARTICLE_A });

    expect(res.status).toBe(201);
    expect(res.body.data.alreadyBookmarked).toBe(true);
    await expect(repo.listIds(USER_ID)).resolves.toEqual([ARTICLE_A]);
  });

  it('returns 400 when articleId is missing', async () => {
    const res = await request(app).post('/api/bookmarks').set('Authorization', auth()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for a malformed articleId', async () => {
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth())
      .send({ articleId: 'not-an-object-id' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when the article does not exist', async () => {
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth())
      .send({ articleId: ABSENT_ARTICLE });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/bookmarks', () => {
  const auth = () => bearer({ sub: USER_ID, role: 'USER' });

  it('removes a single bookmark', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A, ARTICLE_B]);

    const res = await request(app).delete(`/api/bookmarks/${ARTICLE_A}`).set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ articleId: ARTICLE_A, bookmarked: false });
    await expect(repo.listIds(USER_ID)).resolves.toEqual([ARTICLE_B]);
  });

  it('returns 404 when the article was not bookmarked', async () => {
    const res = await request(app).delete(`/api/bookmarks/${ARTICLE_A}`).set('Authorization', auth());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).delete('/api/bookmarks/nope').set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  it('clears every bookmark', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A, ARTICLE_B]);

    const res = await request(app).delete('/api/bookmarks').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ cleared: true });
    await expect(repo.listIds(USER_ID)).resolves.toEqual([]);
  });
});

describe('GET /api/bookmarks/ids', () => {
  it('returns just the ids, and is not shadowed by DELETE /:id', async () => {
    repo.seedBookmarks(USER_ID, [ARTICLE_A, ARTICLE_B]);

    const res = await request(app)
      .get('/api/bookmarks/ids')
      .set('Authorization', bearer({ sub: USER_ID, role: 'USER' }));

    expect(res.status).toBe(200);
    expect(res.body.data.ids).toEqual([ARTICLE_A, ARTICLE_B]);
  });
});

describe('bookmarks — failure propagation', () => {
  it('surfaces a repository fault as 500 in the standard envelope', async () => {
    const failing = new FakeBookmarkRepository();
    failing.findByUser = async () => {
      throw new Error('mongo is down');
    };

    const failingApp = express();
    failingApp.use(express.json());
    failingApp.use('/api/bookmarks', createBookmarkRouter(failing));
    failingApp.use(errorHandler);

    const res = await request(failingApp)
      .get('/api/bookmarks')
      .set('Authorization', bearer({ sub: USER_ID, role: 'USER' }));

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });
});
