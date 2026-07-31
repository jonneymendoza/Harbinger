export interface SitemapEntry {
  url: string;
  lastModified: Date | null;
}

export interface ParsedSitemap {
  /** Child sitemaps, when this document is an index rather than a URL set. */
  children: string[];
  entries: SitemapEntry[];
  isIndex: boolean;
}

const parseDate = (raw?: string): Date | null => {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Parses a sitemap or sitemap index.
 *
 * Sitemaps are the other machine-readable route a site can offer besides a
 * feed, and they are often the only one that works when listing pages render
 * client-side — a headless browser sees no links, while the sitemap lists every
 * article with a modification date.
 *
 * Deliberately regex-based rather than a full XML parse: sitemaps are large
 * (Arsenal's runs to 1,900+ URLs across 16 files) and the two fields needed are
 * unambiguous.
 */
export function parseSitemap(xml: string): ParsedSitemap | null {
  if (!/<(sitemapindex|urlset)[\s>]/i.test(xml.slice(0, 2000))) return null;

  const isIndex = /<sitemapindex[\s>]/i.test(xml.slice(0, 2000));

  if (isIndex) {
    const children = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].trim(),
    );
    return { isIndex: true, children, entries: [] };
  }

  const entries: SitemapEntry[] = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    const loc = body.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc || !/^https?:\/\//i.test(loc)) continue;
    entries.push({ url: loc, lastModified: parseDate(body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]) });
  }

  return entries.length > 0 || xml.includes('<urlset')
    ? { isIndex: false, children: [], entries }
    : null;
}

/** Sitemap paths advertised in robots.txt, which is the canonical place to look. */
export function sitemapsFromRobots(robotsTxt: string): string[] {
  return [...robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map((m) => m[1].trim());
}

/**
 * Article URLs, newest first.
 *
 * `pathPattern` narrows an all-purpose sitemap to the section that carries
 * articles — a site-wide sitemap also lists product, tag and profile pages,
 * which are not news.
 */
export function selectArticleUrls(
  entries: SitemapEntry[],
  limit: number,
  pathPattern?: string,
): SitemapEntry[] {
  let filtered = entries;

  if (pathPattern) {
    try {
      const re = new RegExp(pathPattern, 'i');
      filtered = entries.filter((e) => re.test(e.url));
    } catch {
      // An invalid pattern must not silently drop everything; fall back to all.
      console.warn(`[sitemap] Ignoring invalid path pattern: ${pathPattern}`);
    }
  }

  return [...filtered]
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .slice(0, limit);
}
