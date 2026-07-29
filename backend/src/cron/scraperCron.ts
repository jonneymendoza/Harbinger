import cron from 'node-cron';
import { PlaywrightScraper } from '@infrastructure/scraper/playwrightScraper';
import { SourceRepository } from '@infrastructure/repositories/sourceRepository';
import { ArticleRepository } from '@infrastructure/repositories/articleRepository';
import { NewsService } from '@domains/news/services/newsService';

let scraper: PlaywrightScraper | null = null;

/**
 * Initialize the scraper cron job.
 * Runs every 60 minutes by default (configurable via SCRAPER_CRON env var).
 */
export function initScraperCron(): void {
  const cronExpression = process.env.SCRAPER_CRON || '0 * * * *'; // Every hour

  console.log(`[Cron] Scraper scheduled with expression: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    console.log('[Cron] Running scraper job...');

    try {
      // Initialize components (singleton pattern)
      if (!scraper) {
        scraper = new PlaywrightScraper();
      }

      const sourceRepo = new SourceRepository();
      const articleRepo = new ArticleRepository();

      const newsService = new NewsService(
        scraper,
        sourceRepo,
        articleRepo,
        3 // max concurrent pages
      );

      const results = await newsService.runScrapePipeline();

      // Log summary
      for (const result of results) {
        console.log(`[Cron] Source: ${result.sourceName} | Scraped: ${result.articlesScraped} | Skipped: ${result.articlesSkipped} | Errors: ${result.errors.length}`);
        if (result.errors.length > 0) {
          result.errors.forEach((err) => console.error(`[Cron]   - ${err}`));
        }
      }
    } catch (error) {
      console.error('[Cron] Scraper job failed:', error);
    }
  });

  console.log('[Cron] Scraper cron job initialized.');
}

/**
 * Manually trigger a scrape (for testing or admin "Run Now" button).
 */
export async function runScrapeNow(): Promise<any> {
  if (!scraper) {
    scraper = new PlaywrightScraper();
  }

  const sourceRepo = new SourceRepository();
  const articleRepo = new ArticleRepository();

  const newsService = new NewsService(
    scraper,
    sourceRepo,
    articleRepo,
    3
  );

  return newsService.runScrapePipeline();
}
