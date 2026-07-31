import { DiscoveredFeed, discoverFeeds } from './rss/feedDiscovery';
import { parseSitemap, sitemapsFromRobots } from './sitemap/sitemapParser';

export interface DiscoveredSitemap {
  url: string;
  /** URL count, or child-sitemap count when this is an index. */
  entryCount: number;
  isIndex: boolean;
  source: 'robots' | 'common-path' | 'provided';
}

export interface SiteProbeResult {
  feeds: DiscoveredFeed[];
  sitemaps: DiscoveredSitemap[];
  /** The adapter best matching what the site actually offers. */
  recommendedAdapter: 'rss' | 'sitemap' | 'generic';
  reason: string;
}

type Fetcher = (url: string) => Promise<string>;

const COMMON_SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemap'];

async function verifySitemap(
  url: string,
  source: DiscoveredSitemap['source'],
  fetchText: Fetcher,
): Promise<DiscoveredSitemap | null> {
  try {
    const parsed = parseSitemap(await fetchText(url));
    if (!parsed) return null;

    const entryCount = parsed.isIndex ? parsed.children.length : parsed.entries.length;
    if (entryCount === 0) return null;

    return { url, entryCount, isIndex: parsed.isIndex, source };
  } catch {
    return null;
  }
}

/**
 * Finds the sitemaps a site publishes.
 *
 * robots.txt is the canonical advertisement and is checked first; the common
 * paths cover sites that publish one without declaring it.
 */
export async function discoverSitemaps(
  siteUrl: string,
  fetchText: Fetcher,
  limit = 5,
): Promise<DiscoveredSitemap[]> {
  const found: DiscoveredSitemap[] = [];
  const seen = new Set<string>();

  const add = (s: DiscoveredSitemap | null) => {
    if (!s || seen.has(s.url) || found.length >= limit) return;
    seen.add(s.url);
    found.push(s);
  };

  const direct = await verifySitemap(siteUrl, 'provided', fetchText);
  if (direct) {
    add(direct);
    return found;
  }

  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return found;
  }

  try {
    const robots = await fetchText(`${origin}/robots.txt`);
    for (const url of sitemapsFromRobots(robots)) {
      if (found.length >= limit) break;
      add(await verifySitemap(url, 'robots', fetchText));
    }
  } catch {
    // No robots.txt, or it was refused — fall through to the common paths.
  }

  if (found.length > 0) return found;

  for (const path of COMMON_SITEMAP_PATHS) {
    if (found.length >= limit) break;
    add(await verifySitemap(origin + path, 'common-path', fetchText));
  }

  return found;
}

/**
 * Reports every machine-readable route a site offers, so the operator can pick
 * one rather than defaulting to CSS selectors.
 *
 * Ordering reflects cost and durability: a feed carries structured content and
 * costs one request per run; a sitemap gives reliable discovery but still needs
 * a page load per article; selectors are last because they break whenever the
 * markup changes.
 */
export async function probeSite(siteUrl: string, fetchText: Fetcher): Promise<SiteProbeResult> {
  const [feeds, sitemaps] = await Promise.all([
    discoverFeeds(siteUrl, fetchText),
    discoverSitemaps(siteUrl, fetchText),
  ]);

  if (feeds.length > 0) {
    return {
      feeds,
      sitemaps,
      recommendedAdapter: 'rss',
      reason:
        'This site publishes a feed. Feeds carry structured content, survive markup changes, and cost one request per run — prefer one unless its items turn out to be teaser-only.',
    };
  }

  if (sitemaps.length > 0) {
    return {
      feeds,
      sitemaps,
      recommendedAdapter: 'sitemap',
      reason:
        'No feed, but the site publishes a sitemap. That gives reliable article discovery even when the listing page renders client-side and CSS selectors would find nothing.',
    };
  }

  return {
    feeds,
    sitemaps,
    recommendedAdapter: 'generic',
    reason:
      'No feed or sitemap found. Use CSS selectors, and test before saving — selectors break silently when a site changes its markup.',
  };
}
