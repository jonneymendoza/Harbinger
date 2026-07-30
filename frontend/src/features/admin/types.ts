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

/** Preview returned by POST /api/admin/sources/test. */
export interface TestScrapeResult {
  title: string;
  heroImage: string | null;
  fullContent: string;
  summary: string;
  contentImages: string[];
  publishedAt: string;
  category: string | null;
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
