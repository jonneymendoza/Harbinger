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
