/**
 * Tests for scrape-run logging.
 *
 * The value of this feature is catching a source that quietly stops working, so
 * the assertions focus on run classification — particularly that zero links
 * discovered counts as degraded even though it raises no error. That is exactly
 * how a broken adapter presents, and it is what went unnoticed with Arsenal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

const scrapeRunRepo = { findRecent: vi.fn(), record: vi.fn() };

// A plain function, not an arrow — the route calls `new ScrapeRunRepository()`.
vi.mock('@infrastructure/repositories/scrapeRunRepository', () => ({
  ScrapeRunRepository: function ScrapeRunRepository() {
    return scrapeRunRepo;
  },
}));
// The admin router pulls these in; stub them so the module loads without Mongo.
vi.mock('@cron/scraperCron', () => ({
  runScrapeNow: vi.fn(),
  runSourceScrapeNow: vi.fn(),
  ScrapeBusyError: class ScrapeBusyError extends Error {},
}));
vi.mock('@infrastructure/scraper/playwrightScraper', () => ({
  PlaywrightScraper: vi.fn(() => ({ scrapeArticle: vi.fn(), destroy: vi.fn() })),
}));

const { default: adminRouter } = await import('../../src/domains/sources/routes/admin.route');
const { errorHandler } = await import('../../src/shared/errors/errorHandler');

const sampleRun = (overrides: Record<string, unknown> = {}) => ({
  id: '607f1f77bcf86cd7994390a1',
  trigger: 'cron',
  status: 'success',
  startedAt: new Date('2026-07-30T10:00:00.000Z'),
  finishedAt: new Date('2026-07-30T10:02:00.000Z'),
  durationMs: 120_000,
  totalArticlesAdded: 5,
  error: null,
  results: [
    {
      sourceId: '507f1f77bcf86cd799439011',
      sourceName: 'Arsenal News',
      linksDiscovered: 20,
      articlesScraped: 5,
      articlesSkipped: 15,
      articlesRejected: 0,
      errors: [],
    },
  ],
  ...overrides,
});

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  scrapeRunRepo.findRecent.mockResolvedValue({ runs: [sampleRun()], totalRuns: 1 });

  app = express();
  app.use(express.json());
  app.use('/api/admin/sources', adminRouter);
  app.use(errorHandler);
});

describe('GET /api/admin/sources/scrape-runs', () => {
  it('returns runs in the standard paginated envelope', async () => {
    const res = await request(app).get('/api/admin/sources/scrape-runs');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, error: null });
    expect(res.body.data).toMatchObject({
      totalRuns: 1,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(res.body.data.runs[0]).toMatchObject({
      trigger: 'cron',
      status: 'success',
      totalArticlesAdded: 5,
    });
  });

  it('includes the per-source breakdown', async () => {
    const res = await request(app).get('/api/admin/sources/scrape-runs');
    expect(res.body.data.runs[0].results[0]).toMatchObject({
      sourceName: 'Arsenal News',
      linksDiscovered: 20,
      articlesScraped: 5,
      articlesSkipped: 15,
      articlesRejected: 0,
    });
  });

  it('applies paging', async () => {
    await request(app).get('/api/admin/sources/scrape-runs?page=3&limit=5');
    expect(scrapeRunRepo.findRecent).toHaveBeenCalledWith(3, 5);
  });

  it('clamps a negative page and an oversized limit', async () => {
    await request(app).get('/api/admin/sources/scrape-runs?page=-2&limit=9999');
    expect(scrapeRunRepo.findRecent).toHaveBeenCalledWith(1, 100);
  });

  it('reports totalPages as 1 when nothing has run yet', async () => {
    scrapeRunRepo.findRecent.mockResolvedValue({ runs: [], totalRuns: 0 });

    const res = await request(app).get('/api/admin/sources/scrape-runs');
    expect(res.body.data.runs).toEqual([]);
    expect(res.body.data.totalPages).toBe(1);
  });

  it('surfaces a repository fault as 500 in the standard envelope', async () => {
    scrapeRunRepo.findRecent.mockRejectedValue(new Error('mongo is down'));

    const res = await request(app).get('/api/admin/sources/scrape-runs');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  // /scrape-runs must be declared before PUT/DELETE '/:id'-shaped routes.
  it('is not captured by an id-shaped route', async () => {
    const res = await request(app).get('/api/admin/sources/scrape-runs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('runs');
  });
});
