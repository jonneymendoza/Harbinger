import { describe, it, expect } from 'vitest';
import {
  parseSitemap,
  sitemapsFromRobots,
  selectArticleUrls,
} from '../../src/infrastructure/scraper/sitemap/sitemapParser';

const urlset = (urls: string) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

const index = (locs: string[]) =>
  `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<sitemap><loc>${l}</loc><lastmod>2026-07-30T10:00:00Z</lastmod></sitemap>`)
    .join('')}</sitemapindex>`;

describe('parseSitemap', () => {
  it('reads a urlset with modification dates', () => {
    const parsed = parseSitemap(
      urlset(`
        <url><loc>https://example.com/a</loc><lastmod>2026-07-30T10:00:00Z</lastmod></url>
        <url><loc>https://example.com/b</loc><lastmod>2026-07-29T10:00:00Z</lastmod></url>`),
    );

    expect(parsed!.isIndex).toBe(false);
    expect(parsed!.entries).toHaveLength(2);
    expect(parsed!.entries[0].url).toBe('https://example.com/a');
    expect(parsed!.entries[0].lastModified?.toISOString()).toBe('2026-07-30T10:00:00.000Z');
  });

  it('reads an index as child sitemaps, not entries', () => {
    const parsed = parseSitemap(
      index(['https://example.com/sitemaps/1.xml', 'https://example.com/sitemaps/2.xml']),
    );

    expect(parsed!.isIndex).toBe(true);
    expect(parsed!.children).toEqual([
      'https://example.com/sitemaps/1.xml',
      'https://example.com/sitemaps/2.xml',
    ]);
    expect(parsed!.entries).toEqual([]);
  });

  it('tolerates a missing lastmod rather than inventing one', () => {
    const parsed = parseSitemap(urlset('<url><loc>https://example.com/a</loc></url>'));
    expect(parsed!.entries[0].lastModified).toBeNull();
  });

  it('skips relative or malformed locations', () => {
    const parsed = parseSitemap(
      urlset('<url><loc>/relative</loc></url><url><loc>https://example.com/ok</loc></url>'),
    );
    expect(parsed!.entries).toHaveLength(1);
    expect(parsed!.entries[0].url).toBe('https://example.com/ok');
  });

  it('returns null for documents that are not sitemaps', () => {
    expect(parseSitemap('<html><body>Not a sitemap</body></html>')).toBeNull();
    expect(parseSitemap('<?xml version="1.0"?><rss><channel/></rss>')).toBeNull();
  });
});

describe('sitemapsFromRobots', () => {
  it('extracts declared sitemaps regardless of case or spacing', () => {
    const robots = `User-agent: *
Disallow: /admin

Sitemap: https://example.com/sitemap.xml
sitemap:   https://example.com/news-sitemap.xml`;

    expect(sitemapsFromRobots(robots)).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news-sitemap.xml',
    ]);
  });

  it('returns nothing when none are declared', () => {
    expect(sitemapsFromRobots('User-agent: *\nDisallow:')).toEqual([]);
  });
});

describe('selectArticleUrls', () => {
  const entries = [
    { url: 'https://example.com/news/old', lastModified: new Date('2026-07-01') },
    { url: 'https://example.com/news/new', lastModified: new Date('2026-07-30') },
    { url: 'https://example.com/shop/product', lastModified: new Date('2026-07-29') },
    { url: 'https://example.com/news/mid', lastModified: new Date('2026-07-15') },
  ];

  it('returns newest first', () => {
    const picked = selectArticleUrls(entries, 10);
    expect(picked[0].url).toContain('/news/new');
    expect(picked[1].url).toContain('/shop/product');
  });

  it('honours the limit', () => {
    expect(selectArticleUrls(entries, 2)).toHaveLength(2);
  });

  it('filters to a path pattern, so a site-wide sitemap yields only articles', () => {
    const picked = selectArticleUrls(entries, 10, '/news/');
    expect(picked).toHaveLength(3);
    expect(picked.every((e) => e.url.includes('/news/'))).toBe(true);
  });

  // Dropping everything would look like a broken source rather than a bad pattern.
  it('falls back to every entry when the pattern is invalid', () => {
    expect(selectArticleUrls(entries, 10, '([unclosed')).toHaveLength(4);
  });

  it('sorts undated entries last rather than dropping them', () => {
    const withUndated = [...entries, { url: 'https://example.com/news/undated', lastModified: null }];
    const picked = selectArticleUrls(withUndated, 10);
    expect(picked[picked.length - 1].url).toContain('undated');
  });
});
