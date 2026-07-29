/**
 * Live network tests for the source adapters.
 *
 * These hit real websites, so they are opt-in: run with
 *   SCRAPER_LIVE_TESTS=1 npx vitest run tests/adapters.live.test.ts
 * They are the fastest way to notice that a site changed its markup.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { ArsenalAdapter } from '@infrastructure/scraper/adapters/arsenalAdapter';
import { RsiCommLinkAdapter } from '@infrastructure/scraper/adapters/rsiCommLinkAdapter';
import { PlaywrightScraper } from '@infrastructure/scraper/playwrightScraper';
import { Source } from '@domains/news/interfaces/ISourceRepository';

const live = process.env.SCRAPER_LIVE_TESTS === '1';
const describeLive = live ? describe : describe.skip;

const scraper = new PlaywrightScraper();
const ctx = {
  fetchHtml: (url: string) => (scraper as any).fetchHtml(url),
  renderHtml: (url: string, opts?: any) => (scraper as any).renderHtml(url, opts),
};

afterAll(async () => {
  await scraper.destroy();
});

function sourceFor(adapter: string, baseUrl: string): Source {
  return {
    _id: {} as any,
    name: `live-${adapter}`,
    baseUrl,
    adapter,
    articleLinkSelector: '',
    contentSelector: '',
    titleSelector: '',
    imageSelector: '',
    isActive: true,
    createdAt: new Date(),
  };
}

describeLive('ArsenalAdapter (live)', () => {
  const adapter = new ArsenalAdapter();
  const source = sourceFor('arsenal', 'https://www.arsenal.com/news');

  it('discovers article links from the sitemap without a browser', async () => {
    const links = await adapter.discoverLinks(source, ctx, 10);

    expect(links.length).toBe(10);
    for (const link of links) {
      expect(link.href).toMatch(/^https:\/\/www\.arsenal\.com\/news\//);
      expect(link.title).toBeTruthy();
      expect(link.publishedAt).toBeInstanceOf(Date);
    }

    // Sitemap order must be newest-first for the feed to make sense.
    const times = links.map((l) => l.publishedAt!.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  }, 60_000);

  it('parses a real article into populated fields', async () => {
    const [first] = await adapter.discoverLinks(source, ctx, 1);
    const article = await adapter.parseArticle(first.href, source, ctx, first);

    expect(article).not.toBeNull();
    expect(article!.title.length).toBeGreaterThan(3);
    expect(article!.heroImage).toMatch(/^https?:\/\//);
    expect(article!.publishedAt).toBeInstanceOf(Date);
    expect(isNaN(article!.publishedAt.getTime())).toBe(false);
    // The hero must not be repeated in the gallery.
    expect(article!.contentImages).not.toContain(article!.heroImage);
  }, 60_000);
});

describeLive('RsiCommLinkAdapter (live)', () => {
  const adapter = new RsiCommLinkAdapter();
  const source = sourceFor('rsi-commlink', 'https://robertsspaceindustries.com/comm-link');

  it('discovers Comm-Link posts with listing metadata', async () => {
    const links = await adapter.discoverLinks(source, ctx, 10);

    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const link of links) {
      expect(link.href).toMatch(/\/comm-link\/[a-z-]+\/\d+-/i);
      expect(link.title).toBeTruthy();
      expect(link.thumbnailImage).toMatch(/^https?:\/\//);
    }
  }, 60_000);

  it('parses at least one real article and skips promo pages', async () => {
    // Comm-Link mixes prose articles with store/promo landing pages, so walk
    // the listing until a genuine article turns up.
    const links = await adapter.discoverLinks(source, ctx, 10);

    let parsed = null;
    let skipped = 0;
    for (const link of links) {
      const article = await adapter.parseArticle(link.href, source, ctx, link);
      if (article) {
        parsed = article;
        break;
      }
      skipped++;
    }

    expect(parsed, `no article parsed from ${links.length} links`).not.toBeNull();
    expect(parsed!.title.length).toBeGreaterThan(3);
    // The regression this guards: cookie-banner text instead of article prose.
    expect(parsed!.fullContent.length).toBeGreaterThan(200);
    expect(parsed!.fullContent.toLowerCase()).not.toContain('analytics partner');
    expect(parsed!.summary.length).toBeGreaterThan(10);
    expect(parsed!.publishedAt).toBeInstanceOf(Date);
    console.log(`[live] parsed "${parsed!.title}" after skipping ${skipped} non-article page(s)`);
  }, 240_000);
});
