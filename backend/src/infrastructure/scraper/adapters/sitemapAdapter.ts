import * as cheerio from 'cheerio';
import { AdapterContext, AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { parseSitemap, selectArticleUrls, SitemapEntry } from '../sitemap/sitemapParser';
import { resolveUrl, resolveUrls } from '../urlResolver';
import { extractSummary, normalizeDate } from '../contentCleaner';

/** Guards against walking an enormous sitemap index for one run. */
const MAX_CHILD_SITEMAPS = 10;

/**
 * Discovers articles from a site's sitemap, then reads each page.
 *
 * The case this exists for: a listing page that renders client-side. A headless
 * browser sees no anchors, so selector-based discovery finds nothing — but the
 * sitemap lists every article with a `lastmod`, in one static request. Arsenal
 * behaves exactly this way, and its bespoke adapter is this pattern hardcoded.
 *
 * Article parsing falls back to Open Graph tags when no content selector is
 * given, so a site with clean metadata needs no configuration at all.
 */
export class SitemapAdapter implements ISourceAdapter {
  readonly descriptor: AdapterDescriptor = {
    key: 'sitemap',
    label: 'Sitemap',
    description:
      "Finds articles from the site's sitemap.xml, then reads each page. Use when the listing page renders client-side and CSS selectors find no links. Set the Base URL to the sitemap; a content selector is optional.",
    requiresSelectors: false,
  };

  async discoverLinks(source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]> {
    const entries = await this.collectEntries(source.baseUrl, ctx);

    if (entries.length === 0) {
      console.warn(`[sitemap] No URLs found in ${source.baseUrl}`);
      return [];
    }

    // articleLinkSelector is repurposed here as a URL pattern: a site-wide
    // sitemap also lists tag, product and profile pages.
    const selected = selectArticleUrls(entries, limit, source.articleLinkSelector || undefined);

    return selected.map((entry) => ({
      href: entry.url,
      // A real title needs the page; the slug keeps the link past the
      // non-empty-title filter until then.
      title: this.titleFromUrl(entry.url),
      publishedAt: entry.lastModified,
    }));
  }

  async parseArticle(
    url: string,
    source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null> {
    const html = await this.load(url, ctx);
    if (html === null) return null;

    const $ = cheerio.load(html);

    const title =
      (source.titleSelector ? $(source.titleSelector).first().text().trim() : '') ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      '';

    if (!title) {
      console.warn(`[sitemap] No title at ${url}`);
      return null;
    }

    // With no selector, fall back to <article>, then the whole body — Open
    // Graph metadata still gives a usable card either way.
    const $content = source.contentSelector
      ? $(source.contentSelector)
      : $('article').length > 0
        ? $('article')
        : $('main');

    const out = cheerio.load('<div id="harbinger-root"></div>');
    const $root = out('#harbinger-root');
    $content.each((_i, el) => {
      $root.append(out.html($(el).clone() as never));
    });

    $root.find('script, style, noscript, iframe, nav, footer, .ad, .ads, .advertisement').remove();
    $root.find('img').each((_i, img) => {
      const $img = out(img);
      const absolute = resolveUrl(url, $img.attr('src') || $img.attr('data-src'));
      if (absolute) $img.attr('src', absolute);
      else $img.remove();
    });

    const fullContent = $root.html() || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';

    if (fullContent.replace(/<[^>]+>/g, '').trim().length < 120 && !ogDescription) {
      console.log(`[sitemap] Skipping ${url}: no usable article content`);
      return null;
    }

    const heroImage =
      resolveUrl(url, source.imageSelector ? $(source.imageSelector).first().attr('src') : null) ||
      resolveUrl(url, $('meta[property="og:image"]').attr('content')) ||
      null;

    const contentImages = Array.from(
      new Set(resolveUrls(url, $root.find('img').map((_i, img) => out(img).attr('src')).get())),
    ).filter((img) => img !== heroImage);

    // The sitemap's lastmod is a modification date, so a date published on the
    // page itself is more trustworthy when there is one.
    const pageDate =
      $('time[datetime]').first().attr('datetime') ||
      $('meta[property="article:published_time"]').attr('content') ||
      '';

    return {
      title,
      heroImage,
      thumbnailImage: heroImage,
      contentImages,
      fullContent,
      summary: extractSummary(fullContent) || ogDescription,
      category: $('meta[property="article:section"]').attr('content') || null,
      publishedAt: pageDate ? normalizeDate(pageDate) : (hint?.publishedAt ?? new Date()),
    };
  }

  /**
   * Plain HTTP first, rendering only if that yields nothing usable.
   *
   * Cheaper, and it is what actually works on some sites: Arsenal serves
   * articles happily over plain HTTP while answering headless Chrome with
   * "Access Denied" — the reverse of a site that needs JavaScript to render.
   */
  private async load(url: string, ctx: AdapterContext): Promise<string | null> {
    let fetched = '';
    try {
      fetched = await ctx.fetchHtml(url);
      if (this.looksUsable(fetched)) return fetched;
    } catch {
      // Refused or unreachable over plain HTTP; a render may still work.
    }

    try {
      return await ctx.renderHtml(url);
    } catch (error) {
      // Nothing worked, but a thin plain-HTTP response beats nothing.
      if (fetched) return fetched;
      console.warn(`[sitemap] Could not load ${url}:`, error);
      return null;
    }
  }

  /** Enough of a page to be worth parsing, rather than a shell or error page. */
  private looksUsable(html: string): boolean {
    if (html.length < 500) return false;
    const hasTitle = /<meta[^>]+property=["']og:title["']/i.test(html) || /<h1[\s>]/i.test(html);
    const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
    return hasTitle && bodyText.replace(/\s+/g, ' ').trim().length > 400;
  }

  /** Follows a sitemap index one level down, which is the common shape. */
  private async collectEntries(sitemapUrl: string, ctx: AdapterContext): Promise<SitemapEntry[]> {
    const root = parseSitemap(await ctx.fetchHtml(sitemapUrl));
    if (!root) return [];
    if (!root.isIndex) return root.entries;

    const entries: SitemapEntry[] = [];
    for (const child of root.children.slice(0, MAX_CHILD_SITEMAPS)) {
      try {
        const parsed = parseSitemap(await ctx.fetchHtml(child));
        if (parsed && !parsed.isIndex) entries.push(...parsed.entries);
      } catch (error) {
        console.warn(`[sitemap] Skipping child sitemap ${child}:`, error);
      }
    }
    return entries;
  }

  private titleFromUrl(url: string): string {
    const slug = url.replace(/\/$/, '').split('/').pop() || '';
    return (
      slug
        .replace(/\.(html?|php)$/i, '')
        .replace(/-[A-Za-z0-9]{10,}$/, '')
        .replace(/[-_]+/g, ' ')
        .trim() || 'Article'
    );
  }
}
