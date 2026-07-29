import * as cheerio from 'cheerio';

/**
 * Strips scripts, styles, ads, and irrelevant elements from HTML content.
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove scripts, styles, links, and other non-content elements
  $('script, style, link, noscript, iframe, svg, nav, footer, header, .ad, .ads, .advertisement, .sidebar, .related-articles, .comments-section').remove();

  // Remove empty elements
  $('*').each((_i, el) => {
    if ($(el).children().length === 0 && !$(el).text().trim()) {
      $(el).remove();
    }
  });

  return $.html();
}

/**
 * Extracts text content from an HTML string and generates a summary.
 * Skips cookie banners, navigation, and other non-content elements.
 */
export function extractSummary(html: string, maxLength: number = 200): string {
  const $ = cheerio.load(html);
  
  // Remove common non-content elements
  $('.cookie, .cookie-banner, .cookie-notice, .gdpr, .consent, .banner, .popup, .modal').remove();
  $('script, style, nav, footer, header, .sidebar, .ad, .ads, .advertisement').remove();
  
  // Get all paragraphs and find the one with the most text (likely the article content)
  const paragraphs = $('p').toArray()
    .map(p => $(p).text().trim())
    .filter(text => {
      // Filter out cookie-related text, navigation, and short texts
      return text.length > 50 && 
             !text.toLowerCase().includes('cookie') &&
             !text.toLowerCase().includes('analytics partner') &&
             !text.toLowerCase().includes('privacy policy') &&
             !text.toLowerCase().includes('terms of use');
    });
  
  // If we found substantial paragraphs, use the longest one as the summary source
  if (paragraphs.length > 0) {
    paragraphs.sort((a, b) => b.length - a.length);
    const mainContent = paragraphs[0];
    return mainContent.length > maxLength ? mainContent.substring(0, maxLength) + '...' : mainContent;
  }
  
  // Fallback: use all body text
  const text = $('body').text();
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
}

/**
 * Normalizes a date string to ISO 8601 format.
 * Handles common formats like "July 28, 2026", "2026-07-28", "28 Jul 2026", etc.
 */
export function normalizeDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();

  // Try parsing directly first
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  // Handle common formats
  const normalized = dateStr
    .replace(/st|nd|rd|th\b/gi, '') // Remove ordinal suffixes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const parsed = new Date(normalized);
  if (!isNaN(parsed.getTime())) return parsed;

  // Fallback: return current date
  console.warn(`[DateNormalizer] Failed to parse date: "${dateStr}", using current date`);
  return new Date();
}
