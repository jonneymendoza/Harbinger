import { Source } from './ISourceRepository';
import { ScrapedArticle, ScrapedLink } from './IScraperStrategy';

/**
 * Capabilities the host scraper lends to an adapter.
 *
 * Adapters never touch Playwright or `fetch` directly — they ask the context.
 * That keeps every adapter unit-testable with a stubbed context, and lets the
 * host decide browser lifecycle, user-agent rotation, and throttling.
 */
export interface AdapterContext {
  /** Plain HTTP GET. Fast, no JavaScript execution. Prefer this when it works. */
  fetchHtml(url: string): Promise<string>;

  /** Render in a headless browser and return hydrated HTML. Use only when the page needs JS. */
  renderHtml(
    url: string,
    opts?: { waitForSelector?: string; timeoutMs?: number },
  ): Promise<string>;
}

/**
 * Self-description used by the admin UI to render the right form for a source.
 */
export interface AdapterDescriptor {
  /** Stable identifier persisted on the source document. */
  key: string;
  /** Human-readable name shown in the admin dropdown. */
  label: string;
  description: string;
  /**
   * True when the adapter is driven by user-supplied CSS selectors, so the
   * admin form must collect them. Site-specific adapters know their own
   * structure and take no selectors.
   */
  requiresSelectors: boolean;
  /** When set, the adapter only accepts sources whose baseUrl matches. */
  hostPattern?: RegExp;
}

export interface ISourceAdapter {
  readonly descriptor: AdapterDescriptor;

  /** Find candidate article URLs for a source. Returns absolute URLs. */
  discoverLinks(source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]>;

  /**
   * Extract a single article. `hint` carries anything already learned during
   * discovery (listing thumbnails, dates, excerpts) so the adapter can fill
   * fields the article page itself does not expose.
   */
  parseArticle(
    url: string,
    source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null>;
}
