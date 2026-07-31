import { Source } from './ISourceRepository';

export interface ScrapedArticle {
  title: string;
  heroImage: string | null;
  thumbnailImage: string | null;
  contentImages: string[];
  fullContent: string;
  summary: string;
  category: string | null;
  publishedAt: Date;
}

/**
 * A discovered article link. Beyond the URL, listing pages often expose
 * metadata the article page itself hides (publication dates, excerpts,
 * thumbnails); adapters pass those along so nothing is lost.
 */
export interface ScrapedLink {
  href: string;
  title: string;
  thumbnailImage?: string | null;
  summary?: string;
  publishedAt?: Date | null;
  /**
   * Body supplied by the listing itself. Feeds publish the article inline, so
   * the adapter can build the article without fetching the page at all.
   */
  contentHtml?: string;
}

export interface IScraperStrategy {
  scrapeLinks(baseUrl: string, source: Source): Promise<ScrapedLink[]>;
  scrapeArticle(url: string, source: Source, hint?: ScrapedLink): Promise<ScrapedArticle | null>;
  destroy(): Promise<void>;
}
