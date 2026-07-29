import * as cheerio from 'cheerio';
import { AdapterContext, AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { resolveUrl, resolveUrls } from '../urlResolver';
import { extractSummary, normalizeDate } from '../contentCleaner';

/**
 * CSS-selector driven adapter. This is the adapter behind every source added
 * through the admin UI: the operator supplies the selectors, and nothing here
 * is specific to any one site.
 *
 * It renders with a browser because an unknown site may well be client-side
 * rendered, and falls back to plain HTTP only if rendering fails.
 */
export class GenericAdapter implements ISourceAdapter {
  readonly descriptor: AdapterDescriptor = {
    key: 'generic',
    label: 'Generic (CSS selectors)',
    description:
      'Works with any site by following the CSS selectors you provide. Renders the page in a headless browser first, so it handles client-side rendered sites.',
    requiresSelectors: true,
  };

  async discoverLinks(source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]> {
    if (!source.articleLinkSelector) return [];

    const html = await this.load(source.baseUrl, ctx);
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const links: ScrapedLink[] = [];

    $(source.articleLinkSelector).each((_i, el) => {
      if (links.length >= limit) return false;

      const $el = $(el);
      // The selector may target the anchor itself or a card containing one.
      const href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
      const absolute = resolveUrl(source.baseUrl, href);
      if (!absolute || seen.has(absolute)) return;

      const title = (
        (source.titleSelector ? $el.find(source.titleSelector).first().text() : '') ||
        $el.attr('title') ||
        $el.text()
      )
        .trim()
        .replace(/\s+/g, ' ');

      if (!title) return;

      seen.add(absolute);
      links.push({ href: absolute, title });
      return;
    });

    return links;
  }

  async parseArticle(
    url: string,
    source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null> {
    const html = await this.load(url, ctx);
    const $ = cheerio.load(html);

    const title =
      (source.titleSelector ? $(source.titleSelector).first().text().trim() : '') ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      hint?.title ||
      '';

    if (!title) {
      console.warn(`[generic] No title found at ${url}`);
      return null;
    }

    const $content = source.contentSelector ? $(source.contentSelector) : $();
    if ($content.length === 0) {
      console.warn(`[generic] Content selector "${source.contentSelector}" matched nothing at ${url}`);
      return null;
    }

    // Concatenate every match — many sites split an article across sibling blocks.
    const container = cheerio.load('<div id="harbinger-root"></div>');
    const $root = container('#harbinger-root');
    $content.each((_i, el) => {
      $root.append(container.html($(el).clone() as never));
    });

    $root.find('script, style, noscript, iframe, .ad, .ads, .advertisement, .related-articles, .comments-section').remove();

    $root.find('img').each((_i, img) => {
      const $img = container(img);
      const absolute = resolveUrl(url, $img.attr('src') || $img.attr('data-src'));
      if (absolute) $img.attr('src', absolute);
      else $img.remove();
    });

    const fullContent = $root.html() || '';

    const heroFromSelector = source.imageSelector
      ? $(source.imageSelector).first().attr('src') || $(source.imageSelector).first().attr('data-src')
      : null;
    const heroImage =
      resolveUrl(url, heroFromSelector) ||
      resolveUrl(url, $('meta[property="og:image"]').attr('content')) ||
      hint?.thumbnailImage ||
      null;

    const contentImages = Array.from(
      new Set(resolveUrls(url, $root.find('img').map((_i, img) => container(img).attr('src')).get())),
    ).filter((img) => img !== heroImage);

    const publishedAt =
      hint?.publishedAt ??
      normalizeDate(
        $('time[datetime]').first().attr('datetime') ||
          $('meta[property="article:published_time"]').attr('content') ||
          $('meta[name="article:published_time"]').attr('content') ||
          '',
      );

    return {
      title,
      heroImage,
      thumbnailImage: hint?.thumbnailImage || heroImage,
      contentImages,
      fullContent,
      summary: extractSummary(fullContent) || hint?.summary || '',
      category:
        $('meta[property="article:section"]').attr('content') ||
        $('meta[name="article:section"]').attr('content') ||
        null,
      publishedAt,
    };
  }

  /** Render with a browser; fall back to plain HTTP if that fails. */
  private async load(url: string, ctx: AdapterContext): Promise<string> {
    try {
      return await ctx.renderHtml(url);
    } catch (error) {
      console.warn(`[generic] Render failed for ${url}, falling back to plain fetch:`, error);
      return ctx.fetchHtml(url);
    }
  }
}
