import { describe, it, expect, vi } from 'vitest';
import { probeSite, discoverSitemaps } from '../../src/infrastructure/scraper/siteProbe';

const feedXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
  <item><title>One</title><link>https://example.com/one</link><description>d</description></item>
</channel></rss>`;

const sitemapXml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/news/a</loc><lastmod>2026-07-30T00:00:00Z</lastmod></url>
  <url><loc>https://example.com/news/b</loc><lastmod>2026-07-29T00:00:00Z</lastmod></url>
</urlset>`;

const html = (head = '') => `<!doctype html><html><head>${head}</head><body>page</body></html>`;

const fetcherFor = (map: Record<string, string>) =>
  vi.fn(async (url: string) => {
    if (url in map) return map[url];
    throw new Error(`404 ${url}`);
  });

describe('discoverSitemaps', () => {
  it('prefers a sitemap declared in robots.txt', () => {
    const fetchText = fetcherFor({
      'https://example.com/robots.txt': 'User-agent: *\nSitemap: https://example.com/custom.xml',
      'https://example.com/custom.xml': sitemapXml,
    });

    return expect(discoverSitemaps('https://example.com/', fetchText)).resolves.toMatchObject([
      { url: 'https://example.com/custom.xml', source: 'robots', entryCount: 2, isIndex: false },
    ]);
  });

  it('falls back to common paths when robots.txt declares none', async () => {
    const fetchText = fetcherFor({
      'https://example.com/robots.txt': 'User-agent: *\nDisallow:',
      'https://example.com/sitemap.xml': sitemapXml,
    });

    const found = await discoverSitemaps('https://example.com/', fetchText);
    expect(found[0]).toMatchObject({ url: 'https://example.com/sitemap.xml', source: 'common-path' });
  });

  it('still probes common paths when robots.txt is unreachable', async () => {
    const fetchText = fetcherFor({ 'https://example.com/sitemap.xml': sitemapXml });

    const found = await discoverSitemaps('https://example.com/', fetchText);
    expect(found).toHaveLength(1);
  });

  it('reports an index by its child count', async () => {
    const fetchText = fetcherFor({
      'https://example.com/sitemap.xml': `<?xml version="1.0"?><sitemapindex xmlns="x">
        <sitemap><loc>https://example.com/s1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/s2.xml</loc></sitemap></sitemapindex>`,
    });

    const found = await discoverSitemaps('https://example.com/sitemap.xml', fetchText);
    expect(found[0]).toMatchObject({ isIndex: true, entryCount: 2, source: 'provided' });
  });

  it('rejects a path that returns HTML rather than a sitemap', async () => {
    const fetchText = fetcherFor({
      'https://example.com/robots.txt': 'User-agent: *',
      'https://example.com/sitemap.xml': html('<title>404</title>'),
    });

    await expect(discoverSitemaps('https://example.com/', fetchText)).resolves.toEqual([]);
  });
});

describe('probeSite', () => {
  it('recommends rss when a feed exists, even alongside a sitemap', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html('<link rel="alternate" type="application/rss+xml" href="/feed">'),
      'https://example.com/feed': feedXml,
      'https://example.com/robots.txt': 'Sitemap: https://example.com/sitemap.xml',
      'https://example.com/sitemap.xml': sitemapXml,
    });

    const result = await probeSite('https://example.com/', fetchText);

    expect(result.recommendedAdapter).toBe('rss');
    expect(result.feeds).toHaveLength(1);
    // The sitemap is still reported, so the operator can choose it instead.
    expect(result.sitemaps).toHaveLength(1);
    expect(result.reason).toMatch(/feed/i);
  });

  it('recommends sitemap when there is no feed — the Arsenal case', async () => {
    const fetchText = fetcherFor({
      'https://example.com/news': html('<title>Client-rendered listing</title>'),
      'https://example.com/robots.txt': 'Sitemap: https://example.com/sitemap.xml',
      'https://example.com/sitemap.xml': sitemapXml,
    });

    const result = await probeSite('https://example.com/news', fetchText);

    expect(result.recommendedAdapter).toBe('sitemap');
    expect(result.feeds).toEqual([]);
    expect(result.reason).toMatch(/client-side|sitemap/i);
  });

  it('falls back to generic when the site offers neither', async () => {
    const fetchText = fetcherFor({ 'https://example.com/': html('<title>Nothing</title>') });

    const result = await probeSite('https://example.com/', fetchText);

    expect(result.recommendedAdapter).toBe('generic');
    expect(result.reason).toMatch(/CSS selectors/i);
  });

  it('does not throw when everything is refused', async () => {
    const fetchText = vi.fn(async () => {
      throw new Error('403 Forbidden');
    });

    const result = await probeSite('https://blocked.example/', fetchText);
    expect(result).toMatchObject({ feeds: [], sitemaps: [], recommendedAdapter: 'generic' });
  });
});
