export interface Article {
  id: string;
  title: string;
  thumbnailImage?: string;
  summary: string;
  sourceName: string;
  publishedAt: string;
  heroImage?: string;
  contentImages?: string[];
  fullContent?: string;
  sourceUrl?: string;
  category?: string;
  scrapedAt?: string;
}

/** A source that has articles, used to build the feed filters. */
export interface FeedSource {
  id: string;
  name: string;
  /** Short label for the filter pill; falls back to `name` server-side. */
  label: string;
  articleCount: number;
}

export interface FeedSourcesResponse {
  sources: FeedSource[];
  totalArticles: number;
}

export interface NewsListResponse {
  articles: Article[];
  totalArticles: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}
