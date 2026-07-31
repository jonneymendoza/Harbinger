import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('NewsService Pipeline', () => {
  let NewsServiceClass: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/domains/news/services/newsService');
    NewsServiceClass = mod.NewsService;
  });

  it('should return empty array when no active sources', async () => {
    const mockScraper = { scrapeLinks: vi.fn(), scrapeArticle: vi.fn(), destroy: vi.fn() };
    const mockSourceRepo = { findAllActive: vi.fn().mockResolvedValue([]) };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn().mockResolvedValue(null) };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    const result = await service.runScrapePipeline();

    expect(result).toEqual([]);
  });

  it('should call scraper for each active source', async () => {
    const mockScraper = {
      scrapeLinks: vi.fn().mockResolvedValue([
        { href: '/article/1', title: 'Article 1' },
      ]),
      scrapeArticle: vi.fn().mockResolvedValue({
        title: 'Article 1',
        heroImage: null,
        thumbnailImage: null,
        contentImages: [],
        fullContent: '<p>Content</p>',
        summary: 'Content',
        category: null,
        publishedAt: new Date(),
      }),
      destroy: vi.fn(),
    };

    const mockSource = {
      _id: { toString: () => 'source-1' },
      name: 'Test Source',
      baseUrl: 'https://example.com',
      articleLinkSelector: '.article-link',
      contentSelector: '.content',
      titleSelector: 'h1',
      imageSelector: 'img',
    };

    const mockSourceRepo = { findAllActive: vi.fn().mockResolvedValue([mockSource]) };
    const mockArticleRepo = {
      upsert: vi.fn().mockResolvedValue({}),
      findBySourceUrl: vi.fn().mockResolvedValue(null),
    };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    const result = await service.runScrapePipeline();

    expect(result).toHaveLength(1);
    expect(result[0].sourceName).toBe('Test Source');
    expect(result[0].articlesScraped).toBe(1);
    expect(mockScraper.scrapeLinks).toHaveBeenCalledWith('https://example.com', mockSource);
  });

  it('should skip already-existing articles', async () => {
    const mockScraper = {
      scrapeLinks: vi.fn().mockResolvedValue([
        { href: '/article/1', title: 'Article 1' },
      ]),
      scrapeArticle: vi.fn().mockResolvedValue({
        title: 'Article 1',
        heroImage: null,
        thumbnailImage: null,
        contentImages: [],
        fullContent: '<p>Content</p>',
        summary: 'Content',
        category: null,
        publishedAt: new Date(),
      }),
      destroy: vi.fn(),
    };

    const mockSource = {
      _id: { toString: () => 'source-1' },
      name: 'Test Source',
      baseUrl: 'https://example.com',
      articleLinkSelector: '.article-link',
      contentSelector: '.content',
      titleSelector: 'h1',
      imageSelector: 'img',
    };

    const mockSourceRepo = { findAllActive: vi.fn().mockResolvedValue([mockSource]) };
    const existingArticle = { _id: 'existing-id' };
    const mockArticleRepo = {
      upsert: vi.fn(),
      findBySourceUrl: vi.fn().mockResolvedValue(existingArticle), // Already exists
    };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    const result = await service.runScrapePipeline();

    expect(result[0].articlesSkipped).toBe(1);
    expect(result[0].articlesScraped).toBe(0);
  });

  it('should handle scraping errors gracefully', async () => {
    const mockScraper = {
      scrapeLinks: vi.fn().mockRejectedValue(new Error('Network error')),
      scrapeArticle: vi.fn(),
      destroy: vi.fn(),
    };

    const mockSourceRepo = { findAllActive: vi.fn().mockResolvedValue([
      { _id: {}, name: 'Failing Source', baseUrl: 'https://fail.com' },
    ]) };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn() };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, mockArticleRepo);
    const result = await service.runScrapePipeline();

    expect(result).toHaveLength(1);
    expect(result[0].errors.length).toBeGreaterThan(0);
  });
});

/**
 * Scraping one source on its own is what the admin "Scrape now" button and the
 * automatic fetch after adding a source both use — a full run takes minutes.
 */
describe('NewsService single-source pipeline', () => {
  let NewsServiceClass: any;

  const workingScraper = () => ({
    scrapeLinks: vi.fn().mockResolvedValue([{ href: '/a/1', title: 'One' }]),
    scrapeArticle: vi.fn().mockResolvedValue({
      title: 'One',
      heroImage: null,
      thumbnailImage: null,
      contentImages: [],
      fullContent: '<p>Content</p>',
      summary: 'Content',
      category: null,
      publishedAt: new Date(),
    }),
    destroy: vi.fn(),
  });

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/domains/news/services/newsService');
    NewsServiceClass = mod.NewsService;
  });

  it('scrapes only the requested source, never the whole set', async () => {
    const mockSourceRepo = {
      findAllActive: vi.fn(),
      findById: vi.fn().mockResolvedValue({ _id: 'abc', name: 'Just This One', baseUrl: 'https://one.com' }),
    };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn().mockResolvedValue(null) };

    const service = new NewsServiceClass(workingScraper(), mockSourceRepo, mockArticleRepo);
    const result = await service.runSourcePipeline('abc');

    expect(result.sourceName).toBe('Just This One');
    expect(result.articlesScraped).toBe(1);
    // The whole point: the other sources are not touched.
    expect(mockSourceRepo.findAllActive).not.toHaveBeenCalled();
  });

  // Distinguishable from a source that ran and found nothing, so the route can
  // answer 404 rather than reporting an empty success.
  it('returns null when the source does not exist', async () => {
    const mockSourceRepo = { findAllActive: vi.fn(), findById: vi.fn().mockResolvedValue(null) };

    const service = new NewsServiceClass(workingScraper(), mockSourceRepo, { upsert: vi.fn(), findBySourceUrl: vi.fn() });

    await expect(service.runSourcePipeline('missing')).resolves.toBeNull();
  });

  it('reports a failure as a result rather than throwing', async () => {
    const mockScraper = {
      scrapeLinks: vi.fn().mockRejectedValue(new Error('Network error')),
      scrapeArticle: vi.fn(),
      destroy: vi.fn(),
    };
    const mockSourceRepo = {
      findAllActive: vi.fn(),
      findById: vi.fn().mockResolvedValue({ _id: 'abc', name: 'Failing', baseUrl: 'https://fail.com' }),
    };

    const service = new NewsServiceClass(mockScraper, mockSourceRepo, { upsert: vi.fn(), findBySourceUrl: vi.fn() });
    const result = await service.runSourcePipeline('abc');

    expect(result.sourceName).toBe('Failing');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // An admin asking for this source by id means it, whatever the active flag
  // says — otherwise "Scrape now" would silently do nothing on a paused source.
  it('scrapes an inactive source when asked for by id', async () => {
    const mockSourceRepo = {
      findAllActive: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue({ _id: 'abc', name: 'Paused', baseUrl: 'https://p.com', isActive: false }),
    };
    const mockArticleRepo = { upsert: vi.fn(), findBySourceUrl: vi.fn().mockResolvedValue(null) };

    const service = new NewsServiceClass(workingScraper(), mockSourceRepo, mockArticleRepo);
    const result = await service.runSourcePipeline('abc');

    expect(result.articlesScraped).toBe(1);
  });
});
