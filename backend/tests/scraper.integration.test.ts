/**
 * End-to-end tests for PlaywrightScraper (the adapter host + registry).
 *
 * Adapter-level behaviour is covered in adapters.live.test.ts; this file checks
 * that a Source document routes to the right adapter and comes back with data.
 *
 * Network-dependent cases are opt-in:
 *   SCRAPER_LIVE_TESTS=1 npx vitest run tests/scraper.integration.test.ts
 */
import { describe, it, expect, afterEach } from 'vitest';
import { PlaywrightScraper } from '../src/infrastructure/scraper/playwrightScraper';
import { Source } from '../src/domains/news/interfaces/ISourceRepository';

const live = process.env.SCRAPER_LIVE_TESTS === '1';
const describeLive = live ? describe : describe.skip;

function sourceFor(overrides: Partial<Source> & { adapter: string; baseUrl: string }): Source {
  return {
    _id: null as any,
    name: overrides.name ?? 'test-source',
    articleLinkSelector: '',
    contentSelector: '',
    titleSelector: '',
    imageSelector: '',
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  } as Source;
}

describe('PlaywrightScraper lifecycle', () => {
  it('constructs and destroys cleanly, repeatedly', async () => {
    const a = new PlaywrightScraper();
    await a.destroy();

    const b = new PlaywrightScraper();
    await b.destroy();

    // destroy() must be safe to call when no browser was ever launched.
    await b.destroy();
    expect(true).toBe(true);
  });
});

describeLive('PlaywrightScraper end-to-end', () => {
  let scraper: PlaywrightScraper;

  afterEach(async () => {
    await scraper?.destroy();
  });

  it('routes an Arsenal source through the arsenal adapter', async () => {
    scraper = new PlaywrightScraper(5);
    const source = sourceFor({
      name: 'Arsenal News',
      adapter: 'arsenal',
      baseUrl: 'https://www.arsenal.com/news',
    });

    const links = await scraper.scrapeLinks(source.baseUrl, source);
    expect(links.length).toBe(5);
    // Adapters return absolute URLs, so callers never rebuild them.
    expect(links[0].href).toMatch(/^https:\/\/www\.arsenal\.com\/news\//);

    const article = await scraper.scrapeArticle(links[0].href, source, links[0]);
    expect(article).toBeTruthy();
    expect(article!.title).toBeTruthy();
    expect(article!.summary.toLowerCase()).not.toContain('cookie');
    if (article!.heroImage) expect(article!.heroImage).toMatch(/^https?:\/\//);
  }, 120_000);

  it('routes an RSI source through the comm-link adapter', async () => {
    scraper = new PlaywrightScraper(5);
    const source = sourceFor({
      name: 'RSI Comm-Link',
      adapter: 'rsi-commlink',
      baseUrl: 'https://robertsspaceindustries.com/comm-link',
    });

    const links = await scraper.scrapeLinks(source.baseUrl, source);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].href).toMatch(/\/comm-link\/[a-z-]+\/\d+-/i);
  }, 120_000);

  it('survives a source whose selectors match nothing', async () => {
    scraper = new PlaywrightScraper(5);
    const source = sourceFor({
      name: 'Broken Source',
      adapter: 'generic',
      baseUrl: 'https://example.com',
      articleLinkSelector: '.definitely-not-present',
      contentSelector: '.also-not-present',
    });

    // A misconfigured source must degrade to an empty result, never throw.
    const links = await scraper.scrapeLinks(source.baseUrl, source);
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBe(0);

    const article = await scraper.scrapeArticle('https://example.com', source);
    expect(article).toBeNull();
  }, 120_000);
});
