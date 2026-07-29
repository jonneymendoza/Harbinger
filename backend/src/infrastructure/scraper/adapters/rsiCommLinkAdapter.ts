import * as cheerio from 'cheerio';
import { AdapterContext, AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { ScrapedArticle, ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { resolveUrl, resolveUrls } from '../urlResolver';
import { extractSummary } from '../contentCleaner';

const ORIGIN = 'https://robertsspaceindustries.com';
const CARDS_PER_PAGE = 10;
/** Below this, a page is chrome or a promo blurb rather than an article. */
const MIN_ARTICLE_CHARS = 200;

/**
 * Roberts Space Industries Comm-Link adapter — the official Star Citizen news
 * channel, as opposed to the Community Hub (which carries user-submitted
 * screenshots with no article body at all).
 *
 * Listing pages are server-rendered, so discovery is plain HTTP and also
 * harvests each card's title, thumbnail, excerpt and relative date. Article
 * bodies are hydrated client-side, so those do need a browser render.
 */
export class RsiCommLinkAdapter implements ISourceAdapter {
  readonly descriptor: AdapterDescriptor = {
    key: 'rsi-commlink',
    label: 'RSI Comm-Link (Star Citizen news)',
    description:
      "Reads Roberts Space Industries' official Comm-Link news channel. Discovery is server-rendered; article bodies are read after rendering. Needs no CSS selectors.",
    requiresSelectors: false,
    hostPattern: /(^|\.)robertsspaceindustries\.com$/i,
  };

  async discoverLinks(source: Source, ctx: AdapterContext, limit: number): Promise<ScrapedLink[]> {
    const base = source.baseUrl || `${ORIGIN}/comm-link`;
    const links: ScrapedLink[] = [];
    const seen = new Set<string>();
    const maxPages = Math.max(1, Math.ceil(limit / CARDS_PER_PAGE));

    for (let page = 1; page <= maxPages && links.length < limit; page++) {
      const pageUrl = page === 1 ? base : `${base}${base.includes('?') ? '&' : '?'}page=${page}`;

      let html: string;
      try {
        html = await ctx.fetchHtml(pageUrl);
      } catch (error) {
        console.warn(`[rsi-commlink] Failed to fetch listing page ${page}:`, error);
        break;
      }

      const $ = cheerio.load(html);
      const cards = $('a.content-block2');
      if (cards.length === 0) {
        console.warn(`[rsi-commlink] No cards on listing page ${page}; markup may have changed`);
        break;
      }

      cards.each((_i, el) => {
        if (links.length >= limit) return false;

        const $card = $(el);
        const absolute = resolveUrl(ORIGIN, $card.attr('href'));
        // Real posts live at /comm-link/<channel>/<id>-<slug>; skip nav links.
        if (!absolute || !/\/comm-link\/[a-z-]+\/\d+-/i.test(absolute)) return;
        if (seen.has(absolute)) return;

        const title = $card.find('.title').first().text().trim().replace(/\s+/g, ' ');
        if (!title) return;

        const bg = $card.find('.background').attr('style') || '';
        const thumb = bg.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] || null;

        seen.add(absolute);
        links.push({
          href: absolute,
          title,
          thumbnailImage: resolveUrl(ORIGIN, thumb),
          summary: $card.find('.over .body').text().trim().replace(/\s+/g, ' ') || undefined,
          publishedAt: this.parseRelativeDate($card.find('.time_ago .value').text().trim()),
        });
        return;
      });
    }

    return links;
  }

  async parseArticle(
    url: string,
    _source: Source,
    ctx: AdapterContext,
    hint?: ScrapedLink,
  ): Promise<ScrapedArticle | null> {
    // Article prose is injected after hydration, so a plain fetch returns
    // an unrendered Smarty template.
    const html = await ctx.renderHtml(url, { waitForSelector: '.g-article__body' });
    const $ = cheerio.load(html);

    // The listing title is the authoritative one: og:title and <h1> are often
    // a section heading ("COMMUNITY MVP"), and recurring series would otherwise
    // all collapse to the same name.
    const title =
      hint?.title ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      '';

    if (!title) {
      console.warn(`[rsi-commlink] No title found at ${url}`);
      return null;
    }

    // An article is split across several sibling .g-article__body blocks;
    // taking only the first would silently truncate most posts.
    const bodies = $('.g-article__body');
    if (bodies.length === 0) {
      // Comm-Link also carries store and promo landing pages built on a
      // different template with no prose. They are not news, so skip them.
      console.log(`[rsi-commlink] Skipping non-article page ${url}`);
      return null;
    }

    const out = cheerio.load('<div id="harbinger-root"></div>');
    const $root = out('#harbinger-root');
    bodies.each((_i, el) => {
      $root.append(out.html($(el).clone() as never));
    });

    $root.find('script, style, noscript, iframe').remove();
    $root.find('img').each((_i, img) => {
      const $img = out(img);
      const absolute = resolveUrl(url, $img.attr('src') || $img.attr('data-src'));
      if (absolute) $img.attr('src', absolute);
      else $img.remove();
    });

    const fullContent = $root.html() || '';

    if ($root.text().trim().length < MIN_ARTICLE_CHARS) {
      console.log(`[rsi-commlink] Skipping ${url}: article body too short to be news`);
      return null;
    }

    const heroImage =
      resolveUrl(url, $('meta[property="og:image"]').attr('content')) ||
      hint?.thumbnailImage ||
      null;

    const contentImages = Array.from(
      new Set(resolveUrls(url, $root.find('img').map((_i, img) => out(img).attr('src')).get())),
    ).filter((img) => img !== heroImage);

    // og:description on Comm-Link is site-wide boilerplate, so prefer the
    // listing excerpt, then the body text.
    const summary = hint?.summary || extractSummary(fullContent);

    return {
      title,
      heroImage,
      thumbnailImage: hint?.thumbnailImage || heroImage,
      contentImages,
      fullContent,
      summary,
      category: this.channelFromUrl(url),
      publishedAt: hint?.publishedAt ?? new Date(),
    };
  }

  private channelFromUrl(url: string): string | null {
    const m = url.match(/\/comm-link\/([a-z-]+)\//i);
    if (!m) return null;
    return m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Comm-Link cards show relative ages ("2 days ago") rather than timestamps.
   * Approximating from those beats defaulting every article to "now", which
   * would make the feed's date ordering meaningless.
   */
  private parseRelativeDate(text: string): Date | null {
    if (!text) return null;
    const m = text.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
    if (!m) return null;

    const amount = Number(m[1]);
    const unitMs: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
      year: 31_536_000_000,
    };

    const ms = unitMs[m[2].toLowerCase()];
    if (!ms) return null;
    return new Date(Date.now() - amount * ms);
  }
}
