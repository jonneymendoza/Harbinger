/** Arsenal article link discovery via Playwright DOM rendering. */

import type { PlaywrightScraper } from '@infrastructure/scraper/playwrightScraper';
import { ScrapedLink } from '@domains/news/interfaces/IScraperStrategy';

export async function fetchArsenalArticleLinks(
  scraper: PlaywrightScraper,
  baseUrl: string,
  limit: number = 50,
): Promise<ScrapedLink[]> {
  const page = await scraper.getPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    const content = await page.content();
    const results: ScrapedLink[] = [];
    const seenSlugs = new Set<string>();
    const urlPattern = /href=["'](https:\/\/www\.arsenal\.com\/news\/([a-z]+)-([A-Z][a-zA-Z0-9]{4,}))["']/gi;

    // --- Strategy 1: inline JSON from SSR payload in the page source ---
    let m: RegExpExecArray | null;
    while ((m = urlPattern.exec(content)) !== null) {
      const [_fullUrl, section, slug] = m;
      if (!seenSlugs.has(slug) && !/^men$|^women$|^club$|^academy$/i.test(section)) {
        seenSlugs.add(slug);
        results.push({ href: slug, title: 'Arsenal News Article' });
      }
    }

    // --- Strategy 2: pageProps.articleBody from __NEXT_DATA__ ---
    if (results.length === 0) {
      const ndMatch = content.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (ndMatch) {
        let data: any;
        try { data = JSON.parse(ndMatch[1]); } catch {}
        for (const blk of data?.props?.pageProps?.article?.articleBody || []) {
          // check direct image/src fields
          const candidates = [String(blk.image), String(blk.src)];
          // check linkUrl on items
          for (const item of blk.items || []) {
            candidates.push(String((item as any).linkUrl));
          }
          for (const candidate of candidates) {
            if (/\/\/[a-z]+-[A-Z]/.test(candidate)) {
              const sm = candidate.match(/\/([a-z]+)-([A-Z][a-zA-Z0-9]{4,})/);
              if (sm && !seenSlugs.has(sm[2]) && !/^men$|^women$|^club$|^academy$/i.test(sm[1])) {
                seenSlugs.add(sm[2]);
                results.push({ href: sm[2], title: 'Arsenal News Article' });
              }
            }
          }
        }
      }
    }

    // --- Strategy 3: rendered DOM (JS-loaded cards) ---
    if (results.length === 0) {
      const pageResults = await page.evaluate(() => {
        const s: Array<{ slug: string; text: string }> = [];
        const seen = new Set<string>();
        try {
          const doc = (globalThis as any).document;
          const links = doc?.querySelectorAll('a[href]');
          if (links) {
            for (let i = 0; i < links.length; i++) {
              const el = links[i];
              const href = String(el.getAttribute?.('href') || '');
              const match = href.match(/\/news\/([a-z]+)-([A-Z][a-zA-Z0-9]{4,})/i);
              if (match && !/^men$|^women$|^club$|^academy$/i.test(match[1])) {
                if (!seen.has(match[2])) {
                  seen.add(match[2]);
                  s.push({ slug: match[2], text: String(el.textContent?.trim() || '') });
                }
              }
            }
          }
        } catch {}
        return s;
      });
      results.push(...pageResults.map(s => ({ href: s.slug, title: s.text || 'Arsenal News Article' })));
    }

    // --- Strategy 4: GraphQL fallback ---
    if (results.length === 0) {
      console.log('[Scraper] Arsenal: Trying GraphQL API for discovery...');
      const gqlLinks = await tryGraphQL(baseUrl, limit);
      results.push(...gqlLinks);
    }

    console.log(`[Scraper] Arsenal found ${results.length} articles`);
    return results;

  } finally {
    await page.close();
  }
}

/** Try multiple GraphQL query formats as fallback */
async function tryGraphQL(baseUrl: string, limit: number): Promise<ScrapedLink[]> {
  const urlPath = new URL(baseUrl).pathname;
  const catMap: Record<string, string> = {
    '/men': '85375', '/women': '85376', '/club': '85377', '/academy': '85378',
  };
  const catMatch = urlPath.match(/\/news\/(\w+)/);
  const categoryId = catMap[catMatch?.[1] || ''] || '85375';

  const queries: Array<{ q: string; v?: Record<string, unknown> }> = [
    { q: `query($id:String!){feeds(id:$id,type:"content",date:{from:"2024-01-01",to:"2030-12-31"}){items{id,title,slug}}}`, v: undefined },
  ];

  for (const { q, v } of queries) {
    try {
      const resp = await fetch('https://afc-prd.graph.arsenal.com/graphql', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Origin': 'https://www.arsenal.com',
          'Referer': `https://www.arsenal.com/news${urlPath}`,
        },
        body: JSON.stringify({ query: q, variables: v || {} }),  
        signal: AbortSignal.timeout(20000),
      });

      if (resp.ok) {
        const json = await resp.json() as Record<string, unknown>;
        let items: any[] = [];
        
        // Recurse to find items array in the response
        const walk = (obj: unknown): boolean => {
          if (!obj || typeof obj !== 'object') return false;
          if (Array.isArray((obj as any)?.items)) { items = (obj as any).items; return true; }
          if (Array.isArray((obj as any)?.data)) { items = (obj as any).data; return true; }
          for (const key of Object.keys(obj as Record<string, unknown>)) {
            if (walk((obj as Record<string, unknown>)[key])) return true;
          }
          return false;
        };
        
        walk(json.data);
        
        if (items.length > 0) {
          console.log(`[Scraper] GraphQL returned ${items.length} items`);
          return items.slice(0, limit).map((item: any) => ({
            href: String(item.slug || `article-${item.id}`),
            title: item.title || 'Arsenal News Article',
          }));
        }
      }
    } catch {}
  }

  console.log('[Scraper] Arsenal: GraphQL fallback returned no results');
  return [];
}
