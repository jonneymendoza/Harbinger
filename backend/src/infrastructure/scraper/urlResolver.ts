/**
 * Resolves relative URLs to absolute URLs based on a base URL.
 */
export function resolveUrl(baseUrl: string, relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl || !baseUrl) return null;

  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    // If URL constructor fails, return as-is (might already be absolute)
    return relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')
      ? relativeUrl
      : null;
  }
}

/**
 * Resolves an array of relative URLs to absolute URLs.
 */
export function resolveUrls(baseUrl: string, urls: (string | null | undefined)[]): string[] {
  return urls
    .map((url) => resolveUrl(baseUrl, url))
    .filter((url): url is string => url !== null && url.length > 0);
}
