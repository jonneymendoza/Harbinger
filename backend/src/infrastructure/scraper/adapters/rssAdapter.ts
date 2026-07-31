import { AdapterContext, AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { FeedItem, parseFeed } from '../rss/feedParser';

/** Below this, the feed gave a teaser rather than an article body. */
const THIN_CONTENT_CHARS = 400;

/**
 * Reads an RSS or Atom feed.
 *
 * The article page is never fetched: everything comes from the feed itself.
 * That is the point — a site can block automated access to its HTML while
 * publishing a feed for exactly this purpose, which is the case for
 * TechPowerUp, where every page request returns 403 while /rss/news serves
 * 113 items happily.
 *
 * It also means one HTTP request per run instead of one per article.
 */
export class RssAdapter implements ISourceAdapter {
  readonly descriptor: AdapterDescriptor = {
    key: 'rss',
    label: 'RSS / Atom feed',
    description:
      "Reads articles straight from a site's RSS or Atom feed. Needs no CSS selectors, and works on sites that block scrapers but publish a feed. Set the Base URL to the feed itself.",
    requiresSelectors: false,
  };

  async discoverLinks(source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]> {
    const items = await this.loadItems(source.baseUrl, ctx);

    return items.slice(0, limit).map((item) => ({
      href: item.link,
      title: item.title || 'Untitled',
      summary: item.summary || undefined,
      publishedAt: item.publishedAt,
      thumbnailImage: item.imageUrl,
      // Carried through so parseArticle needs no second request.
      contentHtml: item.contentHtml || undefined,
    }));
  }

  async parseArticle(
    url: string,
    source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null> {
    // The pipeline passes the discovery hint straight through. The admin test
    // endpoint does not, so fall back to locating the item in the feed.
    let item: Pick<FeedItem, 'title' | 'contentHtml' | 'summary' | 'publishedAt' | 'imageUrl' | 'categories'> | null =
      null;

    if (hint?.contentHtml || hint?.summary) {
      item = {
        title: hint.title,
        contentHtml: hint.contentHtml ?? '',
        summary: hint.summary ?? '',
        publishedAt: hint.publishedAt ?? null,
        imageUrl: hint.thumbnailImage ?? null,
        categories: [],
      };
    } else {
      // Prefer the configured feed, but accept the tested URL being the feed
      // itself — that is what an operator naturally pastes when checking one.
      const feedUrl = source.baseUrl || url;
      let items = await this.loadItems(feedUrl, ctx);

      if (items.length === 0 && feedUrl !== url) {
        items = await this.loadItems(url, ctx);
      }

      item =
        items.find((i) => i.link === url) ??
        // Testing the feed URL: the first item is a fair sample of the feed.
        (items.length > 0 && !items.some((i) => i.link === url) ? items[0] : null);

      if (!item) {
        console.log(`[rss] ${url} is not in the feed at ${feedUrl}`);
        return null;
      }
    }

    const body = item.contentHtml?.trim() || '';
    const title = item.title?.trim();

    if (!title) {
      console.warn(`[rss] Feed item for ${url} has no title`);
      return null;
    }

    // A teaser-only feed still yields a usable card; the source link takes the
    // reader to the full piece.
    if (body.length < THIN_CONTENT_CHARS && !item.summary) {
      console.log(`[rss] Skipping ${url}: feed item carried no usable content`);
      return null;
    }

    const contentHtml = body || `<p>${item.summary}</p>`;

    return {
      title,
      heroImage: item.imageUrl ?? null,
      thumbnailImage: item.imageUrl ?? null,
      // Images already inside the body are rendered by the frontend from
      // fullContent; listing them again would duplicate them in the gallery.
      contentImages: [],
      fullContent: contentHtml,
      summary: item.summary || '',
      category: item.categories?.[0] ?? null,
      publishedAt: item.publishedAt ?? new Date(),
    };
  }

  /** Plain HTTP: a feed is static XML, so a browser render would be wasted. */
  private async loadItems(feedUrl: string, ctx: AdapterContext): Promise<FeedItem[]> {
    const xml = await ctx.fetchHtml(feedUrl);
    const feed = parseFeed(xml);

    if (!feed) {
      console.warn(`[rss] ${feedUrl} did not parse as RSS or Atom`);
      return [];
    }
    return feed.items;
  }
}
