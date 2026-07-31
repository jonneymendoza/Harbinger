import { describe, it, expect } from 'vitest';
import { parseFeed, looksLikeFeed } from '../../src/infrastructure/scraper/rss/feedParser';

const rss = (items: string, channelExtra = '') => `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>Example News</title>${channelExtra}${items}</channel>
</rss>`;

describe('parseFeed — RSS', () => {
  it('extracts the fields an article needs', () => {
    const feed = parseFeed(
      rss(`<item>
        <title>A Headline</title>
        <link>https://example.com/a-headline</link>
        <pubDate>Wed, 30 Jul 2026 10:00:00 +0000</pubDate>
        <description><![CDATA[<p>Body text with <a href="#">a link</a>.</p>]]></description>
        <enclosure url="https://example.com/hero.jpg" type="image/jpeg" length="1000"/>
        <category>Hardware</category>
      </item>`),
    );

    expect(feed).not.toBeNull();
    expect(feed!.title).toBe('Example News');
    expect(feed!.items).toHaveLength(1);
    expect(feed!.items[0]).toMatchObject({
      title: 'A Headline',
      link: 'https://example.com/a-headline',
      imageUrl: 'https://example.com/hero.jpg',
      categories: ['Hardware'],
    });
    expect(feed!.items[0].publishedAt?.toISOString()).toBe('2026-07-30T10:00:00.000Z');
    // Summary is plain text even when the body is HTML.
    expect(feed!.items[0].summary).toContain('Body text with a link');
    expect(feed!.items[0].summary).not.toContain('<a');
  });

  it('prefers content:encoded over the description teaser', () => {
    const feed = parseFeed(
      rss(`<item>
        <title>T</title><link>https://example.com/x</link>
        <description>Short teaser</description>
        <content:encoded><![CDATA[<p>The full article body.</p>]]></content:encoded>
      </item>`),
    );

    expect(feed!.items[0].contentHtml).toContain('The full article body');
    // The teaser still drives the summary.
    expect(feed!.items[0].summary).toBe('Short teaser');
  });

  it('falls back to an image embedded in the body', () => {
    const feed = parseFeed(
      rss(`<item><title>T</title><link>https://example.com/x</link>
        <description><![CDATA[<p><img src="https://example.com/inline.png"> text</p>]]></description>
      </item>`),
    );
    expect(feed!.items[0].imageUrl).toBe('https://example.com/inline.png');
  });

  it('reads media:content and media:thumbnail', () => {
    const feed = parseFeed(
      rss(`<item><title>T</title><link>https://example.com/x</link>
        <description>d</description>
        <media:thumbnail url="https://example.com/thumb.jpg"/>
      </item>`),
    );
    expect(feed!.items[0].imageUrl).toBe('https://example.com/thumb.jpg');
  });

  it('skips items without a usable absolute link', () => {
    const feed = parseFeed(
      rss(`<item><title>Relative</title><link>/not-absolute</link><description>d</description></item>
           <item><title>Good</title><link>https://example.com/ok</link><description>d</description></item>`),
    );
    expect(feed!.items).toHaveLength(1);
    expect(feed!.items[0].title).toBe('Good');
  });

  it('leaves publishedAt null rather than inventing a date', () => {
    const feed = parseFeed(
      rss(`<item><title>T</title><link>https://example.com/x</link>
        <description>d</description><pubDate>not a date</pubDate></item>`),
    );
    expect(feed!.items[0].publishedAt).toBeNull();
  });

  it('returns null for XML that is not a feed', () => {
    expect(parseFeed('<?xml version="1.0"?><root><thing/></root>')).toBeNull();
    expect(parseFeed('<html><body><p>Not a feed</p></body></html>')).toBeNull();
  });

  it('returns null for a feed with no items', () => {
    expect(parseFeed(rss(''))).toBeNull();
  });
});

describe('parseFeed — Atom', () => {
  it('reads entries, using the alternate link', () => {
    const atom = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Example</title>
        <entry>
          <title>Atom Post</title>
          <link rel="edit" href="https://example.com/edit/1"/>
          <link rel="alternate" href="https://example.com/atom-post"/>
          <published>2026-07-29T12:00:00Z</published>
          <content type="html">&lt;p&gt;Atom body&lt;/p&gt;</content>
        </entry>
      </feed>`;

    const feed = parseFeed(atom);
    expect(feed!.title).toBe('Atom Example');
    // The edit link must not win over the canonical alternate.
    expect(feed!.items[0].link).toBe('https://example.com/atom-post');
    expect(feed!.items[0].contentHtml).toContain('Atom body');
    expect(feed!.items[0].publishedAt?.toISOString()).toBe('2026-07-29T12:00:00.000Z');
  });
});

describe('looksLikeFeed', () => {
  it.each([
    ['<?xml version="1.0"?><rss version="2.0"><channel/></rss>', true],
    ['<feed xmlns="http://www.w3.org/2005/Atom"><title/></feed>', true],
    ['<rdf:RDF xmlns="http://purl.org/rss/1.0/"></rdf:RDF>', true],
    ['<!doctype html><html><body>hello</body></html>', false],
    ['{"json":true}', false],
  ])('classifies %s', (body, expected) => {
    expect(looksLikeFeed(body)).toBe(expected);
  });
});
