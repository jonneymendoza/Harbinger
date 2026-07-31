import { describe, it, expect, vi } from 'vitest';
import { discoverFeeds } from '../../src/infrastructure/scraper/rss/feedDiscovery';

const feedXml = (title = 'A Feed') => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>${title}</title>
  <item><title>One</title><link>https://example.com/one</link><description>d</description></item>
  <item><title>Two</title><link>https://example.com/two</link><description>d</description></item>
</channel></rss>`;

const html = (body: string) => `<!doctype html><html><head>${body}</head><body>page</body></html>`;

/** Serves only the URLs given; everything else throws, as a 404 would. */
const fetcherFor = (map: Record<string, string>) =>
  vi.fn(async (url: string) => {
    if (url in map) return map[url];
    throw new Error(`404 ${url}`);
  });

describe('discoverFeeds', () => {
  it('returns the URL itself when it is already a feed, without probing further', async () => {
    const fetchText = fetcherFor({ 'https://example.com/rss': feedXml('Direct') });

    const feeds = await discoverFeeds('https://example.com/rss', fetchText);

    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ source: 'provided', itemCount: 2, title: 'Direct' });
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  it('prefers a feed the page declares', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html(
        '<link rel="alternate" type="application/rss+xml" href="/custom/path.xml">',
      ),
      'https://example.com/custom/path.xml': feedXml('Declared'),
    });

    const feeds = await discoverFeeds('https://example.com/', fetchText);

    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({
      url: 'https://example.com/custom/path.xml',
      source: 'declared',
    });
  });

  it('resolves a relative declared href against the site', async () => {
    const fetchText = fetcherFor({
      'https://example.com/news': html('<link rel="alternate" type="application/atom+xml" href="feed.xml">'),
      'https://example.com/feed.xml': feedXml(),
    });

    const feeds = await discoverFeeds('https://example.com/news', fetchText);
    expect(feeds[0].url).toBe('https://example.com/feed.xml');
  });

  it('falls back to common paths when nothing is declared', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html('<title>No feed link here</title>'),
      'https://example.com/rss/news': feedXml('Guessed'),
    });

    const feeds = await discoverFeeds('https://example.com/', fetchText);

    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ source: 'common-path', url: 'https://example.com/rss/news' });
  });

  // The TechPowerUp case: the HTML answers 403 but the feed is served happily.
  it('still finds a feed when the site refuses the page itself', async () => {
    const fetchText = fetcherFor({ 'https://blocked.example/rss/news': feedXml('Open Feed') });

    const feeds = await discoverFeeds('https://blocked.example/', fetchText);

    expect(feeds).toHaveLength(1);
    expect(feeds[0].url).toBe('https://blocked.example/rss/news');
  });

  it('rejects a candidate that is not actually a feed', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html(
        '<link rel="alternate" type="application/rss+xml" href="/not-a-feed">',
      ),
      // A site can return 200 HTML for a missing feed path.
      'https://example.com/not-a-feed': html('<title>404 page</title>'),
    });

    const feeds = await discoverFeeds('https://example.com/', fetchText);
    expect(feeds).toEqual([]);
  });

  it('rejects a feed that parses but has no items', async () => {
    const fetchText = fetcherFor({
      'https://example.com/feed': '<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>',
    });

    const feeds = await discoverFeeds('https://example.com/feed', fetchText);
    expect(feeds).toEqual([]);
  });

  it('returns nothing for a site with no feed anywhere', async () => {
    const fetchText = fetcherFor({ 'https://example.com/': html('<title>Nothing</title>') });
    await expect(discoverFeeds('https://example.com/', fetchText)).resolves.toEqual([]);
  });

  it('honours the limit', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html(
        '<link rel="alternate" type="application/rss+xml" href="/a.xml">' +
          '<link rel="alternate" type="application/rss+xml" href="/b.xml">' +
          '<link rel="alternate" type="application/rss+xml" href="/c.xml">',
      ),
      'https://example.com/a.xml': feedXml('A'),
      'https://example.com/b.xml': feedXml('B'),
      'https://example.com/c.xml': feedXml('C'),
    });

    const feeds = await discoverFeeds('https://example.com/', fetchText, 2);
    expect(feeds).toHaveLength(2);
  });

  it('does not offer the same feed twice', async () => {
    const fetchText = fetcherFor({
      'https://example.com/': html(
        '<link rel="alternate" type="application/rss+xml" href="/feed.xml">' +
          '<link rel="alternate" type="application/atom+xml" href="/feed.xml">',
      ),
      'https://example.com/feed.xml': feedXml(),
    });

    const feeds = await discoverFeeds('https://example.com/', fetchText);
    expect(feeds).toHaveLength(1);
  });
});
