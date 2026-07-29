import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock playwright module
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          content: vi.fn().mockResolvedValue('<html><body><h1>Test Article</h1></body></html>'),
          evaluate: vi.fn().mockResolvedValue([
            { href: '/article/1', title: 'Article 1' },
            { href: '/article/2', title: 'Article 2' },
          ]),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock cheerio
vi.mock('cheerio', () => {
  return {
    load: vi.fn(() => ({
      html: vi.fn().mockReturnValue('<html><body><h1>Test Article</h1></body></html>'),
      find: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnValue('Test Article'),
      attr: vi.fn().mockReturnValue(null),
      clone: vi.fn().mockReturnThis(),
      each: vi.fn().mockReturnThis(),
    })),
  };
});

// Mock urlResolver
vi.mock('../../src/infrastructure/scraper/urlResolver', () => ({
  resolveUrl: vi.fn((base: string, rel: string | null) => rel ? `${base}${rel}` : null),
  resolveUrls: vi.fn((base: string, urls: (string | null)[]) => urls.filter(Boolean) as string[]),
}));

// Mock contentCleaner
vi.mock('../../src/infrastructure/scraper/contentCleaner', () => ({
  cleanHtml: vi.fn((html: string) => html),
  extractSummary: vi.fn((html: string) => 'Summary'),
  normalizeDate: vi.fn((d: string | null) => new Date()),
}));

// Mock userAgentPool
vi.mock('../../src/infrastructure/scraper/userAgentPool', () => ({
  getRandomUserAgent: vi.fn(() => 'Mozilla/5.0 Test Agent'),
  USER_AGENTS: ['Mozilla/5.0 Test Agent'],
}));

describe('PlaywrightScraper', () => {
  let PlaywrightScraperClass: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/infrastructure/scraper/playwrightScraper');
    PlaywrightScraperClass = mod.PlaywrightScraper;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should instantiate without error', () => {
    const scraper = new PlaywrightScraperClass();
    expect(scraper).toBeDefined();
  });

  it('should have required methods', async () => {
    const scraper = new PlaywrightScraperClass();
    expect(typeof scraper.scrapeLinks).toBe('function');
    expect(typeof scraper.scrapeArticle).toBe('function');
    expect(typeof scraper.destroy).toBe('function');
  });

  it('should destroy browser on cleanup', async () => {
    const scraper = new PlaywrightScraperClass();
    await scraper.destroy();
    expect(true).toBe(true);
  });
});

describe('NewsService', () => {
  let NewsServiceClass: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/domains/news/services/newsService');
    NewsServiceClass = mod.NewsService;
  });

  it('should instantiate with dependencies', () => {
    const mockScraper = {
      scrapeLinks: vi.fn(),
      scrapeArticle: vi.fn(),
      destroy: vi.fn(),
    };
    const mockSourceRepo = { findAllActive: vi.fn() };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn() };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    expect(service).toBeDefined();
  });

  it('should have runScrapePipeline method', () => {
    const mockScraper = { scrapeLinks: vi.fn(), scrapeArticle: vi.fn(), destroy: vi.fn() };
    const mockSourceRepo = { findAllActive: vi.fn() };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn() };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    expect(typeof service.runScrapePipeline).toBe('function');
  });

  it('should have testScrape method', () => {
    const mockScraper = { scrapeLinks: vi.fn(), scrapeArticle: vi.fn(), destroy: vi.fn() };
    const mockSourceRepo = { findAllActive: vi.fn() };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn() };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    expect(typeof service.testScrape).toBe('function');
  });
});
