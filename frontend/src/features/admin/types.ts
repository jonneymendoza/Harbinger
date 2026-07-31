/** A scraping target as returned by GET /api/admin/sources. */
export interface Source {
  _id: string;
  name: string;
  displayName?: string;
  baseUrl: string;
  adapter: string;
  articleLimit?: number;
  articleLinkSelector?: string;
  contentSelector?: string;
  titleSelector?: string;
  imageSelector?: string;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Adapter self-description from GET /api/admin/sources/adapters.
 * `requiresSelectors` decides whether the editor shows the CSS selector block —
 * site-specific adapters know their own page structure.
 */
export interface Adapter {
  key: string;
  label: string;
  description: string;
  requiresSelectors: boolean;
}

export interface AdaptersResponse {
  adapters: Adapter[];
  defaultAdapter: string;
  suggested: string | null;
}

/** The article preview, when the test succeeded. */
export interface TestScrapeArticle {
  title: string;
  heroImage: string | null;
  fullContent: string;
  summary: string;
  contentImages: string[];
  publishedAt: string;
  category: string | null;
}

/**
 * What the page actually looked like to the scraper. Returned whether the test
 * passed or failed — a failure is only actionable if you can see why.
 */
export interface TestScrapeDiagnostics {
  pageTitle: string | null;
  renderedChars: number;
  visibleTextChars: number;
  botChallengeDetected: boolean;
  accessBlocked: boolean;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  paragraphCount: number;
  selectorMatches: {
    articleLink: number | null;
    content: number | null;
    title: number | null;
    image: number | null;
  };
  fetchError: string | null;
}

/** Result of POST /api/admin/sources/test. */
export interface TestScrapeResult {
  ok: boolean;
  /** Plain-language cause when `ok` is false. */
  reason: string | null;
  diagnostics: TestScrapeDiagnostics;
  article: TestScrapeArticle | null;
}

/** A feed found by probing a site, offered for the operator to choose. */
export interface DiscoveredFeed {
  url: string;
  title: string;
  itemCount: number;
  /** `declared` came from the page's own <link rel="alternate">. */
  source: 'declared' | 'common-path' | 'provided';
}

/** A sitemap found by probing. */
export interface DiscoveredSitemap {
  url: string;
  entryCount: number;
  isIndex: boolean;
  source: 'robots' | 'common-path' | 'provided';
}

/** Everything machine-readable a site offers, so selectors are a last resort. */
export interface FeedDiscoveryResult {
  feeds: DiscoveredFeed[];
  sitemaps: DiscoveredSitemap[];
  recommendedAdapter: 'rss' | 'sitemap' | 'generic';
  reason: string;
}

/** `source` = an admin scraped one source on its own, rather than the whole set. */
export type ScrapeTrigger = 'boot' | 'cron' | 'manual' | 'source';
/** partial = the run completed but at least one source reported a problem. */
export type ScrapeStatus = 'success' | 'partial' | 'failed';

/** One source's outcome — returned on its own by the per-source scrape endpoint. */
export interface ScrapeRunSourceResult {
  sourceId: string | null;
  sourceName: string;
  linksDiscovered: number;
  articlesScraped: number;
  articlesSkipped: number;
  articlesRejected: number;
  errors: string[];
}

export interface ScrapeRun {
  id: string;
  trigger: ScrapeTrigger;
  status: ScrapeStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalArticlesAdded: number;
  results: ScrapeRunSourceResult[];
  /** Set when the pipeline itself threw, rather than a single source failing. */
  error?: string | null;
}

export interface ScrapeRunPage {
  runs: ScrapeRun[];
  totalRuns: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

/** The editable shape of a source; mirrors what the write endpoints accept. */
export interface SourceFormValues {
  name: string;
  displayName: string;
  baseUrl: string;
  adapter: string;
  articleLimit: string;
  articleLinkSelector: string;
  contentSelector: string;
  titleSelector: string;
  imageSelector: string;
  isActive: boolean;
}

export const emptySourceForm = (defaultAdapter = 'generic'): SourceFormValues => ({
  name: '',
  displayName: '',
  baseUrl: '',
  adapter: defaultAdapter,
  articleLimit: '',
  articleLinkSelector: '',
  contentSelector: '',
  titleSelector: '',
  imageSelector: '',
  isActive: true,
});

export const sourceToForm = (source: Source): SourceFormValues => ({
  name: source.name,
  displayName: source.displayName ?? '',
  baseUrl: source.baseUrl,
  adapter: source.adapter ?? 'generic',
  articleLimit: source.articleLimit ? String(source.articleLimit) : '',
  articleLinkSelector: source.articleLinkSelector ?? '',
  contentSelector: source.contentSelector ?? '',
  titleSelector: source.titleSelector ?? '',
  imageSelector: source.imageSelector ?? '',
  isActive: source.isActive,
});
