import * as cheerio from 'cheerio';

export interface FeedItem {
  title: string;
  link: string;
  /** Item body as published in the feed. May be HTML. */
  contentHtml: string;
  summary: string;
  publishedAt: Date | null;
  imageUrl: string | null;
  categories: string[];
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

/** Strips tags and collapses whitespace, for building a plain-text summary. */
function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses RSS 2.0 and Atom into one shape.
 *
 * Feeds are the sanctioned way to read a site that blocks scrapers, and many
 * publish enough per item (title, link, date, body, image) that the article page
 * never has to be fetched at all.
 */
export function parseFeed(xml: string): ParsedFeed | null {
  // xmlMode keeps namespaced tags like <content:encoded> and <media:content>
  // addressable, which is where the richest content usually lives.
  const $ = cheerio.load(xml, { xmlMode: true });

  const isAtom = $('feed').length > 0 && $('entry').length > 0;
  const nodes = isAtom ? $('entry') : $('item');
  if (nodes.length === 0) return null;

  const items: FeedItem[] = [];

  nodes.each((_i, el) => {
    const $el = $(el);

    const link = isAtom
      ? // Atom puts the URL in an attribute; prefer the canonical alternate.
        $el.find('link[rel="alternate"]').attr('href') ||
        $el.find('link').first().attr('href') ||
        ''
      : $el.find('link').first().text().trim() || $el.find('guid').first().text().trim();

    if (!link || !/^https?:\/\//i.test(link)) return;

    // content:encoded carries the full body when present; description is often
    // only a teaser, so prefer the richer field.
    const contentHtml = (
      $el.find('content\\:encoded').first().text() ||
      (isAtom ? $el.find('content').first().text() : '') ||
      $el.find('description').first().text() ||
      $el.find('summary').first().text() ||
      ''
    ).trim();

    const descriptionText = toText(
      $el.find('description').first().text() || $el.find('summary').first().text() || contentHtml,
    );

    const imageUrl =
      $el.find('enclosure[type^="image"]').attr('url') ||
      $el.find('media\\:content[medium="image"]').attr('url') ||
      $el.find('media\\:thumbnail').attr('url') ||
      firstImage(contentHtml);

    items.push({
      title: ($el.find('title').first().text() || '').trim(),
      link,
      contentHtml,
      summary: descriptionText.slice(0, 400),
      publishedAt: parseDate(
        $el.find('pubDate').first().text() ||
          $el.find('published').first().text() ||
          $el.find('updated').first().text() ||
          $el.find('dc\\:date').first().text(),
      ),
      imageUrl: imageUrl || null,
      categories: $el
        .find('category')
        .map((_j, c) => $(c).text().trim() || $(c).attr('term') || '')
        .get()
        .filter(Boolean),
    });
  });

  if (items.length === 0) return null;

  return {
    title: ($('channel > title').first().text() || $('feed > title').first().text() || '').trim(),
    items,
  };
}

/** Cheap pre-check so callers can reject a page before paying to parse it. */
export function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 1500);
  return /<rss[\s>]|<feed[\s>][^>]*xmlns|<rdf:RDF/i.test(head);
}
