import { AdapterContext, AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { extractArsenalArticleBody, extractArsenalHeroImage } from '../arsenalBodyParser';
import { extractSummary } from '../contentCleaner';

const SITEMAP_INDEX = 'https://www.arsenal.com/sitemaps/articles/sitemap.xml';

/**
 * Arsenal.com adapter.
 *
 * Discovery uses Arsenal's own articles sitemap rather than the listing pages.
 * The listing pages render their cards client-side and expose no anchors to a
 * headless browser, whereas the sitemap is a single static XML file, already
 * ordered by `lastmod`, that robots.txt explicitly permits. One request
 * replaces a browser session.
 *
 * Article pages embed everything in `__NEXT_DATA__`, so plain HTTP suffices
 * there too — no Playwright anywhere in this adapter.
 */
export class ArsenalAdapter implements ISourceAdapter {
  readonly descriptor: AdapterDescriptor = {
    key: 'arsenal',
    label: 'Arsenal.com',
    description:
      "Discovers articles from Arsenal's published sitemap and reads article content from the embedded Next.js payload. Needs no CSS selectors.",
    requiresSelectors: false,
    hostPattern: /(^|\.)arsenal\.com$/i,
  };

  async discoverLinks(_source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]> {
    // The sitemap index fans out to paginated children, newest first.
    const indexXml = await ctx.fetchHtml(SITEMAP_INDEX);
    const childUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (childUrls.length === 0) {
      console.warn('[arsenal] Sitemap index contained no child sitemaps');
      return [];
    }

    const collected: ScrapedLink[] = [];
    const seen = new Set<string>();

    // Page 1 holds the most recent articles; walk further only if we need more.
    for (const childUrl of childUrls) {
      if (collected.length >= limit) break;

      let xml: string;
      try {
        xml = await ctx.fetchHtml(childUrl);
      } catch (error) {
        console.warn(`[arsenal] Failed to fetch ${childUrl}:`, error);
        continue;
      }

      const entries = [
        ...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g),
      ]
        .map((m) => ({ url: m[1].trim(), lastmod: m[2].trim() }))
        .filter((e) => e.url.includes('/news/'))
        .sort((a, b) => b.lastmod.localeCompare(a.lastmod));

      for (const entry of entries) {
        if (collected.length >= limit) break;
        if (seen.has(entry.url)) continue;
        seen.add(entry.url);
        collected.push({
          href: entry.url,
          // Real titles come from the article payload; the slug is a placeholder
          // so the link survives the caller's non-empty-title filter.
          title: this.titleFromSlug(entry.url),
          publishedAt: new Date(entry.lastmod),
        });
      }
    }

    return collected;
  }

  async parseArticle(
    url: string,
    _source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null> {
    const html = await ctx.fetchHtml(url);

    const article = this.readArticleJson(html);
    if (!article) {
      console.warn(`[arsenal] No __NEXT_DATA__ article payload at ${url}`);
      return null;
    }

    const title = String(article.title || '').trim();
    if (!title) {
      console.warn(`[arsenal] Article payload at ${url} has no title`);
      return null;
    }

    const fullContent = extractArsenalArticleBody(html);
    const heroImage = extractArsenalHeroImage(html);

    // IMAGE blocks carry the gallery; the hero is rendered separately by the
    // frontend, so keep it out of contentImages to avoid showing it twice.
    const imageBlockUrls: string[] = (Array.isArray(article.articleBody) ? article.articleBody : [])
      .filter((b: any) => String(b?.type).toUpperCase() === 'IMAGE')
      .map((b: any) => b?.src || b?.image)
      .filter((src: unknown): src is string => typeof src === 'string' && src.startsWith('http'));

    const contentImages = Array.from(new Set(imageBlockUrls)).filter((img) => img !== heroImage);

    const publishedAt = article.publicationDate
      ? new Date(String(article.publicationDate))
      : hint?.publishedAt ?? new Date();

    return {
      title,
      heroImage,
      thumbnailImage: heroImage,
      contentImages,
      fullContent,
      summary: extractSummary(fullContent),
      category: article.primaryTaxonomyName ? String(article.primaryTaxonomyName) : null,
      publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    };
  }

  private readArticleJson(html: string): any | null {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
      return JSON.parse(m[1])?.props?.pageProps?.article ?? null;
    } catch {
      return null;
    }
  }

  private titleFromSlug(url: string): string {
    const slug = url.split('/').pop() || '';
    return (
      slug
        // Trailing 12-character content id carries no meaning for a reader.
        .replace(/-[A-Za-z0-9]{10,}$/, '')
        .replace(/-/g, ' ')
        .trim() || 'Arsenal article'
    );
  }
}
