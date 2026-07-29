import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { IScraperStrategy, ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { AdapterContext } from '@domains/news/interfaces/ISourceAdapter';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { getRandomUserAgent } from './userAgentPool';
import { resolveAdapterForSource } from './adapters';

const DEFAULT_LINK_LIMIT = 50;
const DEFAULT_RENDER_TIMEOUT_MS = 45_000;

/**
 * Host for the scraping adapters.
 *
 * This class owns browser lifecycle and HTTP plumbing; it holds no knowledge
 * of any particular site. Which adapter runs is resolved per source, so new
 * sources can be added at runtime without touching this file.
 *
 * The browser is launched lazily — adapters that only need plain HTTP (such as
 * Arsenal's sitemap-based discovery) never pay for a Chromium process.
 */
export class PlaywrightScraper implements IScraperStrategy {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private linkLimit: number;

  constructor(linkLimit: number = DEFAULT_LINK_LIMIT) {
    this.linkLimit = linkLimit;
  }

  async scrapeLinks(baseUrl: string, source: Source): Promise<ScrapedLink[]> {
    const adapter = resolveAdapterForSource(source);
    console.log(`[Scraper] ${source.name}: discovering via "${adapter.descriptor.key}" adapter`);

    const links = await adapter.discoverLinks(
      { ...source, baseUrl: baseUrl || source.baseUrl },
      this.adapterContext(),
      this.linkLimit,
    );

    const usable = links.filter((l) => l.href && l.title);
    console.log(`[Scraper] ${source.name}: ${usable.length} link(s) discovered`);
    return usable;
  }

  async scrapeArticle(url: string, source: Source, hint?: ScrapedLink): Promise<ScrapedArticle | null> {
    const adapter = resolveAdapterForSource(source);
    try {
      return await adapter.parseArticle(url, source, this.adapterContext(), hint);
    } catch (error) {
      console.error(`[Scraper] ${adapter.descriptor.key} failed on ${url}:`, error);
      return null;
    }
  }

  /** Capabilities handed to adapters. */
  private adapterContext(): AdapterContext {
    return {
      fetchHtml: (url) => this.fetchHtml(url),
      renderHtml: (url, opts) => this.renderHtml(url, opts),
    };
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`GET ${url} returned ${response.status}`);
    }
    return response.text();
  }

  private async renderHtml(
    url: string,
    opts?: { waitForSelector?: string; timeoutMs?: number },
  ): Promise<string> {
    const timeout = opts?.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
    const page = await this.getPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      if (opts?.waitForSelector) {
        try {
          await page.waitForSelector(opts.waitForSelector, { timeout: 15_000 });
        } catch {
          // Fall through: the caller decides whether the missing selector is fatal.
          console.warn(`[Scraper] Selector "${opts.waitForSelector}" never appeared on ${url}`);
        }
      } else {
        await page.waitForTimeout(2_000);
      }

      return await page.content();
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Returns a new page. Caller closes it. */
  async getPage(): Promise<Page> {
    await this.ensureBrowser();
    return this.context!.newPage();
  }

  private async ensureBrowser(): Promise<void> {
    if (this.browser && this.context) return;

    this.browser = await chromium.launch({
      headless: process.env.SCRAPER_HEADFUL !== 'true',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-GB',
      extraHTTPHeaders: {
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    });

    // Sites commonly gate on navigator.webdriver; clearing it keeps ordinary
    // pages from serving us a bot-detection interstitial.
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async destroy(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }
}
