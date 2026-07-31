import * as cheerio from 'cheerio';
import { looksLikeFeed, parseFeed } from './feedParser';

export interface DiscoveredFeed {
  url: string;
  title: string;
  itemCount: number;
  /** How it was found — a declared feed is more trustworthy than a guessed path. */
  source: 'declared' | 'common-path' | 'provided';
}

/**
 * Paths tried only when a site declares no feed. Ordered so a news-specific
 * feed outranks a site-wide one, since a news aggregator wants articles rather
 * than every forum post.
 */
const COMMON_PATHS = [
  '/rss/news',
  '/feed',
  '/rss',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
  '/index.xml',
  '/news/rss',
  '/blog/feed',
];

type Fetcher = (url: string) => Promise<string>;

const absolute = (href: string, base: string): string | null => {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
};

/** Fetches a candidate and keeps it only if it really parses as a feed. */
async function verify(
  url: string,
  source: DiscoveredFeed['source'],
  fetchText: Fetcher,
): Promise<DiscoveredFeed | null> {
  try {
    const body = await fetchText(url);
    if (!looksLikeFeed(body)) return null;

    const feed = parseFeed(body);
    if (!feed || feed.items.length === 0) return null;

    return { url, title: feed.title || url, itemCount: feed.items.length, source };
  } catch {
    return null;
  }
}

/**
 * Finds usable feeds for a site.
 *
 * Declared `<link rel="alternate">` tags are checked first: they are what the
 * site itself points at. Common paths are a fallback for sites that publish a
 * feed without advertising it — which includes sites that block scrapers on
 * their HTML but leave the feed open.
 *
 * Every candidate is fetched and parsed before being offered, so the admin UI
 * never suggests a URL that turns out not to be a feed.
 */
export async function discoverFeeds(
  siteUrl: string,
  fetchText: Fetcher,
  limit = 5,
): Promise<DiscoveredFeed[]> {
  const found: DiscoveredFeed[] = [];
  const seen = new Set<string>();

  const add = (feed: DiscoveredFeed | null) => {
    if (!feed || seen.has(feed.url) || found.length >= limit) return;
    seen.add(feed.url);
    found.push(feed);
  };

  // The URL given may already be a feed.
  const direct = await verify(siteUrl, 'provided', fetchText);
  if (direct) {
    add(direct);
    return found;
  }

  // Declared feeds.
  let declared: string[] = [];
  try {
    const html = await fetchText(siteUrl);
    const $ = cheerio.load(html);
    declared = $('link[rel="alternate"]')
      .filter((_i, el) => /rss|atom|xml/i.test($(el).attr('type') || ''))
      .map((_i, el) => absolute($(el).attr('href') || '', siteUrl))
      .get()
      .filter((u): u is string => !!u);
  } catch {
    // A site that blocks the HTML page can still serve a feed, so fall through
    // to the common paths rather than giving up here.
  }

  for (const url of declared) {
    if (found.length >= limit) break;
    add(await verify(url, 'declared', fetchText));
  }

  if (found.length > 0) return found;

  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return found;
  }

  for (const path of COMMON_PATHS) {
    if (found.length >= limit) break;
    add(await verify(origin + path, 'common-path', fetchText));
  }

  return found;
}
