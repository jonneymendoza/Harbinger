/**
 * Tests for POST /api/admin/sources/test.
 *
 * The endpoint exists to explain *why* a configuration does not work. It used
 * to return a bare "Failed to scrape the provided URL with the given
 * configuration", with the real cause going only to container stdout — so these
 * assertions are mostly about the reason it reports, and the order it picks one
 * when several things are wrong at once.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

const scraperInstance = {
  renderHtml: vi.fn(),
  fetchHtml: vi.fn(),
  scrapeArticle: vi.fn(),
  destroy: vi.fn(async () => undefined),
};

vi.mock('@infrastructure/scraper/playwrightScraper', () => ({
  PlaywrightScraper: function PlaywrightScraper() {
    return scraperInstance;
  },
}));
vi.mock('@cron/scraperCron', () => ({
  runScrapeNow: vi.fn(),
  runSourceScrapeNow: vi.fn(),
  ScrapeBusyError: class ScrapeBusyError extends Error {},
}));
vi.mock('@infrastructure/repositories/scrapeRunRepository', () => ({
  ScrapeRunRepository: function ScrapeRunRepository() {
    return { findRecent: vi.fn(), record: vi.fn() };
  },
}));

const { default: adminRouter } = await import('../../src/domains/sources/routes/admin.route');
const { errorHandler } = await import('../../src/shared/errors/errorHandler');

const ARTICLE_URL = 'https://example.com/news/a-story';

const page = (body: string, title = 'A Story') =>
  `<html><head><title>${title}</title></head><body>${body}</body></html>`;

const goodArticle = {
  title: 'A Story',
  heroImage: 'https://example.com/hero.jpg',
  fullContent: '<p>Body</p>',
  summary: 'A summary',
  contentImages: [],
  publishedAt: new Date('2026-07-01T00:00:00.000Z'),
  category: null,
};

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  scraperInstance.renderHtml.mockResolvedValue(page('<div class="post"><p>Body text here</p></div>'));
  scraperInstance.scrapeArticle.mockResolvedValue(goodArticle);

  app = express();
  app.use(express.json());
  app.use('/api/admin/sources', adminRouter);
  app.use(errorHandler);
});

const post = (body: Record<string, unknown>) =>
  request(app).post('/api/admin/sources/test').send(body);

describe('POST /api/admin/sources/test — success', () => {
  it('returns the article and no reason', async () => {
    const res = await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.reason).toBeNull();
    expect(res.body.data.article).toMatchObject({ title: 'A Story', summary: 'A summary' });
  });

  it('reports diagnostics even when the test passes', async () => {
    const res = await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });

    expect(res.body.data.diagnostics).toMatchObject({
      pageTitle: 'A Story',
      accessBlocked: false,
      botChallengeDetected: false,
    });
    expect(res.body.data.diagnostics.selectorMatches.content).toBe(1);
  });

  it('always closes the browser', async () => {
    await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });
    expect(scraperInstance.destroy).toHaveBeenCalled();
  });
});

describe('POST /api/admin/sources/test — reasons', () => {
  beforeEach(() => scraperInstance.scrapeArticle.mockResolvedValue(null));

  // The case that prompted this: TechPowerUp answers the container with a 403
  // page, so no selector could ever match.
  it('reports a site block ahead of anything about selectors', async () => {
    scraperInstance.renderHtml.mockResolvedValue(
      page('<h1>Access Denied</h1>', '403 - Access Denied'),
    );

    // Selector is also missing, but the block is the actionable cause.
    const res = await post({ url: ARTICLE_URL, adapter: 'generic' });

    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.diagnostics.accessBlocked).toBe(true);
    expect(res.body.data.reason).toMatch(/refused the request/i);
    expect(res.body.data.reason).toContain('403 - Access Denied');
  });

  it('reports a bot challenge', async () => {
    scraperInstance.renderHtml.mockResolvedValue(
      page('<h1>Automated bot check in progress</h1>', 'Checking'),
    );

    const res = await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });

    expect(res.body.data.diagnostics.botChallengeDetected).toBe(true);
    expect(res.body.data.reason).toMatch(/bot-check page/i);
  });

  it('names the missing content selector for the generic adapter', async () => {
    const res = await post({ url: ARTICLE_URL, adapter: 'generic' });
    expect(res.body.data.reason).toMatch(/Main content body/i);
  });

  it('reports a selector that matched nothing, quoting it back', async () => {
    const res = await post({
      url: ARTICLE_URL,
      adapter: 'generic',
      contentSelector: '.not-here',
    });

    expect(res.body.data.diagnostics.selectorMatches.content).toBe(0);
    expect(res.body.data.reason).toContain('.not-here');
  });

  it('reports a page with no paragraphs as probably not an article', async () => {
    scraperInstance.renderHtml.mockResolvedValue(page('<div class="post"><span>x</span></div>'));

    const res = await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });
    expect(res.body.data.reason).toMatch(/no paragraphs/i);
  });

  it('reports a load failure without pretending to have a page', async () => {
    scraperInstance.renderHtml.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

    const res = await post({ url: ARTICLE_URL, adapter: 'generic', contentSelector: '.post' });

    expect(res.body.data.reason).toMatch(/could not be loaded/i);
    expect(res.body.data.diagnostics.fetchError).toContain('ERR_NAME_NOT_RESOLVED');
    // No point parsing a page we never got.
    expect(scraperInstance.scrapeArticle).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/sources/test — validation', () => {
  it('returns 400 without a url', async () => {
    const res = await post({ adapter: 'generic' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for a malformed url', async () => {
    const res = await post({ url: 'not-a-url', adapter: 'generic' });
    expect(res.status).toBe(400);
    expect(scraperInstance.renderHtml).not.toHaveBeenCalled();
  });
});
