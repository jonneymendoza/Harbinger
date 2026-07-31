/**
 * Contract tests for POST /api/admin/sources/:id/scrape.
 *
 * Scraping one source on its own is what the "Scrape now" button calls, and
 * what runs automatically once a source is added. Before it existed the only
 * option was a run over every source, which takes minutes and spends nearly all
 * of it on sources that have nothing new — long enough that an admin would
 * check the feed, see nothing, and assume the source had failed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

const runSourceScrapeNow = vi.fn();
const runScrapeNow = vi.fn();
const findById = vi.fn();

class ScrapeBusyError extends Error {
  constructor() {
    super('A scrape is already in progress. Wait for it to finish and try again.');
    this.name = 'ScrapeBusyError';
  }
}

vi.mock('@cron/scraperCron', () => ({ runScrapeNow, runSourceScrapeNow, ScrapeBusyError }));
vi.mock('@infrastructure/repositories/sourceRepository', () => ({
  SourceRepository: function SourceRepository() {
    return { findById };
  },
}));
vi.mock('@infrastructure/scraper/playwrightScraper', () => ({
  PlaywrightScraper: function PlaywrightScraper() {
    return { renderHtml: vi.fn(), fetchHtml: vi.fn(), scrapeArticle: vi.fn(), destroy: vi.fn() };
  },
}));
vi.mock('@infrastructure/repositories/scrapeRunRepository', () => ({
  ScrapeRunRepository: function ScrapeRunRepository() {
    return { findRecent: vi.fn(), record: vi.fn() };
  },
}));

const { default: adminRouter } = await import('../../src/domains/sources/routes/admin.route');
const { errorHandler } = await import('../../src/shared/errors/errorHandler');

const SOURCE_ID = '507f1f77bcf86cd799439055';

const result = (overrides: Record<string, unknown> = {}) => ({
  sourceId: SOURCE_ID,
  sourceName: 'MMO RPG news',
  linksDiscovered: 30,
  articlesScraped: 30,
  articlesSkipped: 0,
  articlesRejected: 0,
  errors: [],
  ...overrides,
});

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  findById.mockResolvedValue({ _id: SOURCE_ID, name: 'MMO RPG news' });
  runSourceScrapeNow.mockResolvedValue(result());

  app = express();
  app.use(express.json());
  app.use('/api/admin/sources', adminRouter);
  app.use(errorHandler);
});

const scrape = (id: string) => request(app).post(`/api/admin/sources/${id}/scrape`).send({});

describe('POST /api/admin/sources/:id/scrape', () => {
  it('returns the per-source counts the toast reports', async () => {
    const res = await scrape(SOURCE_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, error: null });
    expect(res.body.data).toMatchObject({
      sourceName: 'MMO RPG news',
      linksDiscovered: 30,
      articlesScraped: 30,
    });
    expect(runSourceScrapeNow).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('scrapes only the named source, never the full pipeline', async () => {
    await scrape(SOURCE_ID);
    expect(runScrapeNow).not.toHaveBeenCalled();
  });

  it('rejects a malformed id without starting a scrape', async () => {
    const res = await scrape('not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(runSourceScrapeNow).not.toHaveBeenCalled();
  });

  // Checked before the run so a deleted source does not leave an empty entry
  // in the scrape log.
  it('404s an unknown source without recording a run', async () => {
    findById.mockResolvedValue(null);
    const res = await scrape(SOURCE_ID);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(runSourceScrapeNow).not.toHaveBeenCalled();
  });

  // 409 rather than 500: the request was valid, the timing was not. The admin
  // UI turns this into "wait for the current run", not "something broke".
  it('reports a concurrent scrape as a conflict', async () => {
    runSourceScrapeNow.mockRejectedValue(new ScrapeBusyError());
    const res = await scrape(SOURCE_ID);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(/already in progress/i);
  });

  // A source that runs but finds nothing is a success with zeroes, not an
  // error — the toast has to be able to say "0 new articles".
  it('reports a run that found nothing as success', async () => {
    runSourceScrapeNow.mockResolvedValue(result({ linksDiscovered: 12, articlesScraped: 0, articlesSkipped: 12 }));
    const res = await scrape(SOURCE_ID);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ articlesScraped: 0, articlesSkipped: 12 });
  });

  it('passes a failing source back with its errors', async () => {
    runSourceScrapeNow.mockResolvedValue(
      result({ linksDiscovered: 0, articlesScraped: 0, errors: ['No article links found.'] }),
    );
    const res = await scrape(SOURCE_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toEqual(['No article links found.']);
  });
});

describe('POST /api/admin/sources/run-scraper', () => {
  it('reports a concurrent run as a conflict rather than a server error', async () => {
    runScrapeNow.mockRejectedValue(new ScrapeBusyError());
    const res = await request(app).post('/api/admin/sources/run-scraper').send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
