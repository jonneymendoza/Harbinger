import { IScraperStrategy } from '@domains/news/interfaces/IScraperStrategy';
import { ISourceRepository, Source } from '@domains/news/interfaces/ISourceRepository';
import { ArticleInput, IArticleRepository } from '@domains/news/interfaces/IArticleRepository';
import { Throttler } from '@infrastructure/scraper/throttler';

export interface ScrapeResult {
  sourceName: string;
  linksDiscovered: number;
  articlesScraped: number;
  /** Already stored from an earlier run. */
  articlesSkipped: number;
  /** Fetched but judged not to be an article (promo pages, unparseable layouts). */
  articlesRejected: number;
  errors: string[];
}

export class NewsService {
  private throttler: Throttler;

  constructor(
    private scraper: IScraperStrategy,
    private sourceRepository: ISourceRepository,
    private articleRepository: IArticleRepository,
    maxConcurrent: number = 3
  ) {
    this.throttler = new Throttler(maxConcurrent);
  }

  /**
   * Main extraction pipeline: Source Retrieval → Navigation → Link Discovery → Deep Scraping → Cleaning → Upsert
   */
  async runScrapePipeline(): Promise<ScrapeResult[]> {
    console.log('[NewsService] Starting scrape pipeline...');

    // Step 1: Source Retrieval - fetch all active sources from DB
    const sources = await this.sourceRepository.findAllActive();
    if (sources.length === 0) {
      console.warn('[NewsService] No active sources found in database.');
      return [];
    }

    console.log(`[NewsService] Found ${sources.length} active source(s).`);

    const results: ScrapeResult[] = [];

    // Step 2-6: For each source, execute the extraction pipeline
    for (const source of sources) {
      try {
        const result = await this.scrapeSource(source);
        results.push(result);
      } catch (error) {
        console.error(`[NewsService] Failed to scrape source "${source.name}":`, error);
        results.push({
          sourceName: source.name,
          linksDiscovered: 0,
          articlesScraped: 0,
          articlesSkipped: 0,
          articlesRejected: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    console.log('[NewsService] Scrape pipeline completed.');
    return results;
  }

  /**
   * Scrape a single source: Link Discovery → Deep Scraping → Cleaning → Upsert
   */
  private async scrapeSource(source: Source): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      sourceName: source.name,
      linksDiscovered: 0,
      articlesScraped: 0,
      articlesSkipped: 0,
      articlesRejected: 0,
      errors: [],
    };

    try {
      // Step 3: Link Discovery - find all article links on the source page
      console.log(`[NewsService] Scraping links from ${source.name}...`);
      const links = await this.scraper.scrapeLinks(source.baseUrl, source);
      result.linksDiscovered = links.length;
      console.log(`[NewsService] Found ${links.length} link(s) from ${source.name}.`);

      if (links.length === 0) {
        result.errors.push('No article links found.');
        return result;
      }

      // Step 4-6: Deep Scraping for each link with throttling
      const scrapePromises = links.map(async (link) => {
        try {
          // Resolve relative URLs
          const fullUrl = link.href.startsWith('http')
            ? link.href
            : new URL(link.href, source.baseUrl).href;

          // Check if article already exists in DB
          const existing = await this.articleRepository.findBySourceUrl?.(fullUrl);
          if (existing) {
            result.articlesSkipped++;
            return;
          }

          // Deep scrape the article, handing over whatever the listing already
          // told us (dates, thumbnails, excerpts) so the adapter can fill gaps.
          const scraped = await this.throttler.execute(async () => {
            return this.scraper.scrapeArticle(fullUrl, source, link);
          });

          // A null result means the adapter judged the page not to be an
          // article (promo pages, unparseable layouts). That is an expected
          // outcome, not a failure — errors[] is reserved for thrown faults.
          if (!scraped) {
            result.articlesRejected++;
            return;
          }

          // Step 6: Upsert into DB
          const articleInput: ArticleInput = {
            sourceId: source._id,
            sourceName: source.name,
            sourceUrl: fullUrl,
            title: scraped.title,
            heroImage: scraped.heroImage,
            thumbnailImage: scraped.thumbnailImage,
            contentImages: scraped.contentImages,
            fullContent: scraped.fullContent,
            summary: scraped.summary,
            category: scraped.category,
            publishedAt: scraped.publishedAt,
          };

          await this.articleRepository.upsert(articleInput);
          result.articlesScraped++;
        } catch (error) {
          const errorMsg = `Error scraping ${link.href}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[NewsService] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      });

      // Wait for all scrapes to complete (with throttling)
      await Promise.all(scrapePromises);
    } catch (error) {
      const errorMsg = `Source scraping failed for ${source.name}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[NewsService] ${errorMsg}`);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Test scrape a single URL with provided selectors (for admin "Test Scrape" feature)
   */
  async testScrape(
    url: string,
    config: {
      adapter?: string;
      contentSelector?: string;
      titleSelector?: string;
      imageSelector?: string;
    }
  ): Promise<{ title: string; heroImage: string | null; fullContent: string; summary: string } | null> {
    // Create a temporary source from the candidate configuration
    const tempSource = {
      name: 'Test Source',
      baseUrl: url,
      adapter: config.adapter || 'generic',
      articleLinkSelector: '',
      contentSelector: config.contentSelector || '',
      titleSelector: config.titleSelector || '',
      imageSelector: config.imageSelector || '',
      isActive: true,
      _id: {} as any,
    } as Source;

    const scraped = await this.scraper.scrapeArticle(url, tempSource);
    if (!scraped) return null;

    return {
      title: scraped.title,
      heroImage: scraped.heroImage,
      fullContent: scraped.fullContent,
      summary: scraped.summary,
    };
  }
}
