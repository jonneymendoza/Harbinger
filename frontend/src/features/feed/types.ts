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

export interface NewsListResponse {
  articles: Article[];
  totalArticles: number;
  currentPage: number;
  totalPages: number;
}
