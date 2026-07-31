/**
 * The wording of the scrape completion toast.
 *
 * This matters more than it looks: the toast used to say "New articles are on
 * the feed" regardless of what happened, so a source that fetched nothing —
 * or discovered no links at all — still reported success. An admin then went
 * looking for articles that were never added.
 */
import { describe, it, expect } from 'vitest';
import { describeScrapeResult } from '../api/useSources';
import { ScrapeRunSourceResult } from '../types';

const result = (overrides: Partial<ScrapeRunSourceResult> = {}): ScrapeRunSourceResult => ({
  sourceId: 'abc',
  sourceName: 'MMO News',
  linksDiscovered: 30,
  articlesScraped: 30,
  articlesSkipped: 0,
  articlesRejected: 0,
  errors: [],
  ...overrides,
});

describe('describeScrapeResult', () => {
  it('reports how many articles were added', () => {
    const out = describeScrapeResult(result());

    expect(out.ok).toBe(true);
    expect(out.message).toBe('MMO News: 30 new articles');
    expect(out.detail).toContain('30 links checked');
  });

  it('singularises a single article', () => {
    const out = describeScrapeResult(result({ linksDiscovered: 1, articlesScraped: 1 }));
    expect(out.message).toBe('MMO News: 1 new article');
    expect(out.detail).toContain('1 link checked');
  });

  // A source with nothing new is working correctly, not failing.
  it('treats nothing new as success, not a problem', () => {
    const out = describeScrapeResult(result({ articlesScraped: 0, articlesSkipped: 30 }));

    expect(out.ok).toBe(true);
    expect(out.message).toBe('MMO News is up to date');
    expect(out.detail).toContain('30 already stored');
  });

  // Zero links is how a silently broken adapter presents — it raises no error
  // of its own, so the toast has to catch it.
  it('flags a source that discovered no links at all', () => {
    const out = describeScrapeResult(result({ linksDiscovered: 0, articlesScraped: 0 }));

    expect(out.ok).toBe(false);
    expect(out.message).toContain('found no articles');
    expect(out.detail).toMatch(/feed|configuration/i);
  });

  // The result carries the canonical name; the admin knows the source by the
  // display name shown in the table, and seeing both is confusing.
  it('uses the display label when the caller supplies one', () => {
    const out = describeScrapeResult(result({ sourceName: 'MMO RPG news' }), 'MMO News');
    expect(out.message).toBe('MMO News: 30 new articles');
  });

  it('surfaces the error when the source failed', () => {
    const out = describeScrapeResult(result({ errors: ['403 Forbidden'], linksDiscovered: 0 }));

    expect(out.ok).toBe(false);
    expect(out.message).toBe('MMO News failed');
    expect(out.detail).toBe('403 Forbidden');
  });

  // Comm-Link rejects roughly 6 in 10 posts as promo pages; that is expected
  // behaviour and belongs in the detail rather than being hidden.
  it('mentions rejected pages when there were any', () => {
    const out = describeScrapeResult(
      result({ linksDiscovered: 45, articlesScraped: 18, articlesRejected: 27 }),
    );

    expect(out.ok).toBe(true);
    expect(out.detail).toContain('27 not articles');
  });
});
