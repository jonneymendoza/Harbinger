import cron from 'node-cron';
import { PlaywrightScraper } from '@infrastructure/scraper/playwrightScraper';
import { SourceRepository } from '@infrastructure/repositories/sourceRepository';
import { ArticleRepository } from '@infrastructure/repositories/articleRepository';
import { NewsService, ScrapeResult } from '@domains/news/services/newsService';
import { ScrapeRunRepository } from '@infrastructure/repositories/scrapeRunRepository';
import { ScrapeStatus, ScrapeTrigger } from '@domains/news/models/ScrapeRun';

/**
 * How many of the newest articles to consider per source, per run.
 *
 * This is a per-source ceiling on *candidates*, not on inserts: the pipeline
 * skips any URL already stored, so the first run backfills up to this many and
 * later runs only add what has appeared since.
 */
const ARTICLE_LIMIT = Math.max(1, parseInt(process.env.SCRAPER_ARTICLE_LIMIT || '20', 10) || 20);
const MAX_CONCURRENT_PAGES = Math.max(1, parseInt(process.env.SCRAPER_MAX_CONCURRENT || '3', 10) || 3);

let scraper: PlaywrightScraper | null = null;
/** Guards against a boot scrape and a cron tick overlapping. */
let running = false;

function getScraper(): PlaywrightScraper {
  if (!scraper) {
    scraper = new PlaywrightScraper(ARTICLE_LIMIT);
  }
  return scraper;
}

function buildService(): NewsService {
  return new NewsService(
    getScraper(),
    new SourceRepository(),
    new ArticleRepository(),
    MAX_CONCURRENT_PAGES,
  );
}

function logResults(label: string, results: ScrapeResult[]): void {
  for (const r of results) {
    console.log(
      `[${label}] ${r.sourceName} | discovered: ${r.linksDiscovered} | added: ${r.articlesScraped} | ` +
        `already had: ${r.articlesSkipped} | not articles: ${r.articlesRejected} | errors: ${r.errors.length}`,
    );
    r.errors.forEach((err) => console.error(`[${label}]   - ${err}`));
  }
}

/**
 * A source that errored, or discovered nothing at all, marks the run partial.
 * Zero links is the signal that matters most: it is how a silently broken
 * adapter presents, and it produces no error of its own.
 */
function deriveStatus(results: ScrapeResult[], threw: boolean): ScrapeStatus {
  if (threw) return 'failed';
  if (results.length === 0) return 'partial';
  const degraded = results.filter((r) => r.errors.length > 0 || r.linksDiscovered === 0);
  if (degraded.length === results.length) return 'failed';
  return degraded.length > 0 ? 'partial' : 'success';
}

/**
 * Run the pipeline once, refusing to start a second concurrent run.
 * Two overlapping runs would double the browser load and race on upserts.
 *
 * Every run is persisted — including failures — so the admin log shows what the
 * scraper actually did rather than requiring someone to read container stdout.
 */
async function runOnce(label: string, trigger: ScrapeTrigger): Promise<ScrapeResult[]> {
  if (running) {
    console.log(`[${label}] A scrape is already in progress; skipping this run.`);
    return [];
  }

  running = true;
  const startedAt = new Date();
  let results: ScrapeResult[] = [];
  let failure: string | null = null;

  try {
    results = await buildService().runScrapePipeline();
    logResults(label, results);
    return results;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    running = false;

    const finishedAt = new Date();
    try {
      await new ScrapeRunRepository().record({
        trigger,
        status: deriveStatus(results, failure !== null),
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        totalArticlesAdded: results.reduce((sum, r) => sum + r.articlesScraped, 0),
        results: results.map((r) => ({ ...r })),
        error: failure,
      });
    } catch (recordError) {
      // Logging must never take the scrape down with it.
      console.error(`[${label}] Failed to record scrape run:`, recordError);
    }
  }
}

/**
 * Initialize the scraper cron job.
 * Runs every 60 minutes by default (configurable via SCRAPER_CRON env var).
 */
export function initScraperCron(): void {
  const cronExpression = process.env.SCRAPER_CRON || '0 * * * *'; // Every hour

  console.log(
    `[Cron] Scraper scheduled with expression: ${cronExpression} ` +
      `(up to ${ARTICLE_LIMIT} article(s) per source per run)`,
  );

  cron.schedule(cronExpression, () => {
    void runOnce('Cron', 'cron').catch((error) => console.error('[Cron] Scraper job failed:', error));
  });

  console.log('[Cron] Scraper cron job initialized.');
}

/**
 * Populate the feed at startup so a freshly started stack is not empty until
 * the first cron tick. Runs detached — the HTTP server must not wait on it.
 * Set SCRAPER_RUN_ON_BOOT=false to skip.
 */
export function scheduleInitialScrape(): void {
  if (process.env.SCRAPER_RUN_ON_BOOT === 'false') {
    console.log('[Boot] Initial scrape disabled via SCRAPER_RUN_ON_BOOT=false.');
    return;
  }

  console.log(`[Boot] Initial scrape starting (up to ${ARTICLE_LIMIT} article(s) per source)...`);

  void runOnce('Boot', 'boot')
    .then((results) => {
      const added = results.reduce((sum, r) => sum + r.articlesScraped, 0);
      console.log(`[Boot] Initial scrape finished; ${added} article(s) added.`);
    })
    .catch((error) => console.error('[Boot] Initial scrape failed:', error));
}

/**
 * Manually trigger a scrape (for testing or admin "Run Now" button).
 */
export async function runScrapeNow(): Promise<ScrapeResult[]> {
  return runOnce('Manual', 'manual');
}
