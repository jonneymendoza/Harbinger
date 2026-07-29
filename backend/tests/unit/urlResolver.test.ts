import { describe, it, expect } from 'vitest';
import { resolveUrl, resolveUrls } from '../../src/infrastructure/scraper/urlResolver';

describe('resolveUrl', () => {
  it('should return null for null input', () => {
    expect(resolveUrl('https://example.com', null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(resolveUrl('https://example.com', undefined)).toBeNull();
  });

  it('should resolve relative URL to absolute', () => {
    const result = resolveUrl('https://example.com', '/article/1');
    expect(result).toBe('https://example.com/article/1');
  });

  it('should return absolute URLs unchanged', () => {
    const result = resolveUrl('https://example.com', 'https://cdn.example.com/image.jpg');
    expect(result).toBe('https://cdn.example.com/image.jpg');
  });

  it('should handle relative paths without leading slash', () => {
    const result = resolveUrl('https://example.com/blog/', 'post/1');
    expect(result).toBe('https://example.com/blog/post/1');
  });

  it('should handle edge-case URLs', () => {
    // '///invalid' is technically valid per URL spec - resolves to protocol-relative
    const result = resolveUrl('https://example.com', '///invalid');
    expect(result).toBe('https://invalid/');
  });
});

describe('resolveUrls', () => {
  it('should filter out null and empty URLs', () => {
    const result = resolveUrls('https://example.com', ['https://a.com/img1.jpg', null, '', 'https://b.com/img2.jpg']);
    expect(result).toHaveLength(2);
    expect(result).toContain('https://a.com/img1.jpg');
    expect(result).toContain('https://b.com/img2.jpg');
  });

  it('should resolve all relative URLs', () => {
    const result = resolveUrls('https://example.com', ['/img1.jpg', '/img2.jpg']);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('https://example.com/img1.jpg');
    expect(result[1]).toBe('https://example.com/img2.jpg');
  });

  it('should return empty array for all null inputs', () => {
    const result = resolveUrls('https://example.com', [null, undefined]);
    expect(result).toHaveLength(0);
  });
});
