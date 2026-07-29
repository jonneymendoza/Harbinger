import { describe, it, expect } from 'vitest';
import { cleanHtml, extractSummary, normalizeDate } from '../../src/infrastructure/scraper/contentCleaner';

describe('cleanHtml', () => {
  it('should remove script tags', () => {
    const html = '<div><script>alert("hi")</script><p>Hello</p></div>';
    const result = cleanHtml(html);
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
  });

  it('should remove style tags', () => {
    const html = '<div><style>.foo { color: red; }</style><p>Hello</p></div>';
    const result = cleanHtml(html);
    expect(result).not.toContain('.foo');
    expect(result).toContain('Hello');
  });

  it('should remove ad-related elements', () => {
    const html = '<div class="ad">Ad content</div><p>Real content</p>';
    const result = cleanHtml(html);
    expect(result).not.toContain('Ad content');
    expect(result).toContain('Real content');
  });

  it('should remove empty elements', () => {
    const html = '<div><span></span><p>Content</p></div>';
    const result = cleanHtml(html);
    expect(result).not.toContain('<span></span>');
    expect(result).toContain('Content');
  });
});

describe('extractSummary', () => {
  it('should extract text from HTML', () => {
    const html = '<div><p>This is a summary of the article content.</p></div>';
    const result = extractSummary(html);
    expect(result).toContain('summary');
  });

  it('should truncate long text to default max length', () => {
    const longText = 'a'.repeat(500);
    const html = `<div><p>${longText}</p></div>`;
    const result = extractSummary(html, 200);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(result.endsWith('...')).toBe(true);
  });

  it('should not truncate short text', () => {
    const html = '<div><p>Short</p></div>';
    const result = extractSummary(html, 200);
    expect(result).toContain('Short');
    expect(result.endsWith('...')).toBe(false);
  });
});

describe('normalizeDate', () => {
  it('should parse ISO date string', () => {
    const result = normalizeDate('2026-07-28T10:00:00Z');
    expect(result.getTime()).toBeGreaterThan(0);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('should parse date with ordinal suffixes', () => {
    const result = normalizeDate('July 28th, 2026');
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('should return current date for invalid input', () => {
    const before = new Date();
    const result = normalizeDate('not-a-date');
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('should return current date for null input', () => {
    const before = new Date();
    const result = normalizeDate(null as any);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('should parse "28 Jul 2026" format', () => {
    const result = normalizeDate('28 Jul 2026');
    expect(isNaN(result.getTime())).toBe(false);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // July is 0-indexed
  });
});
