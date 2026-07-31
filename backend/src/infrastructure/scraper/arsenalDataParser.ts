/**
 * Arsenal.com-specific utilities for the PlaywrightScraper.
 * 
 * Arsenal uses a Next.js App Router SPA with two data loading patterns:
 * 
 * 1. LISTING PAGES (/news/all/1, /news/men/1, etc.)
 *    - Server-side rendered shell only contains nav menus (initialMegaNavMenus) and SEO
 *    - Article cards are loaded client-side via Apollo GraphQL to:
 *      https://afc-prd.graph.arsenal.com/graphql
 *    - The listing page returns empty articleBody[] in __NEXT_DATA__
 * 
 * 2. ARTICLE PAGES (/news/section-slug-word-AbCdEfGh)  
 *    - Article content IS server-rendered in __NEXT_DATA__.props.pageProps.article:
 *      - promoImage (URL string) — hero image
 *      - articleBody[] — typed blocks: HEADER, TEXT, IMAGE, LIST
 *        Each block has { type, [textContent|innerHTML|src] }
 * 
 * This module provides helper functions to navigate both patterns.
 */

const ARSENAL_GRAPHQL_ENDPOINT = 'https://afc-prd.graph.arsenal.com/graphql';

// Known content IDs for Arsenal news categories
type CategoryIdMap = Record<string, string>;
const CATEGORY_IDS: CategoryIdMap = {
  'men': '85375',
  'women': '85376',  
  'club': '85377',
  'academy': '85378',
};

/**
 * Fetches article links from Arsenal's GraphQL API endpoint.
 * Used as a fallback when listing pages don't contain inline article data.
 */
export async function fetchArsenalArticleLinks(
  baseUrl: string, 
  limit: number = 50
): Promise<Array<{ href: string; title: string }>> {
  try {
    // Determine the category from the URL
    const urlPath = new URL(baseUrl).pathname;
    const categoryMatch = urlPath.match(/\/news\/(\w+)/);
    const categoryId = CATEGORY_IDS[categoryMatch?.[1] || ''] || '85375';

    // Query the GraphQL API for article listings
    const query = `
      query GetNewsFeed($id: String!, $limit: Int, $date: DateInput) {
        feeds(id: $id, limit: $limit, type: "content", date: $date) {
          items {
            id
            title
            slug
            publishedAt
          }
        }
      }
    `;

    const response = await fetch(ARSENAL_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.arsenal.com',
        'Referer': 'https://www.arsenal.com/news/all/1',
      },
      body: JSON.stringify({
        query,
        variables: { id: categoryId, limit, date: {} },
      }),
    });

    if (!response.ok) {
      console.warn(`[Arsenal API] GraphQL request failed: ${response.status}`);
      return [];
    }

    const json = (await response.json()) as any;
    
    if (json.errors?.[0]?.message || !json.data?.feeds?.data) {
      // Try fallback query formats
      const fallbackResults = await tryFallbackQuery(categoryId, limit);
      return fallbackResults;
    }

    // Parse the feed data  
    const items = json.data.feeds.items || [];
    return items.map((item: any) => ({
      href: item.slug.replace('/news/', '') || `mens-team-${item.id}`,  
      title: item.title || 'Arsenal News Article',
    }));

  } catch (e) {
    console.warn('[Arsenal API] Failed to fetch article links:', e);
    return [];
  }
}

/** Try fallback queries if the primary one fails */
async function tryFallbackQuery(categoryId: string, limit: number): Promise<Array<{ href: string; title: string }>> {
  // Fallback 1: Query with empty data object for feeds 
  const q1 = `query($id:String!){feeds(id:$id,limit:${limit},type:"content"){data{id,title,slug}}}`;
  
  try {
    const r = await fetch(ARSENAL_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ query: q1, variables: { id: categoryId } }),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as any;
    const items = j.data?.feeds?.data || j.data?.feeds?.items || [];
    return (items as any[]).map((i: any) => ({
      href: i.slug?.replace('/news/', '') || `article-${i.id}`,
      title: i.title || 'Arsenal News Article',
    }));
  } catch { /* ignore */ }

  // Fallback 2: Try entries query 
  const q2 = `query($id:String!){entries(collection:"arsenal-news",filter:{category:{slug:{eq:"men"}}},limit:${limit}){items{id,title,slug}}}`;
  try {
    const r = await fetch(ARSENAL_GRAPHQL_ENDPOINT, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q2 }),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as any;
    const items = j.data?.entries?.items || [];
    return (items as any[]).map((i: any) => ({
      href: i.slug || `article-${i.id}`,
      title: i.title || 'Arsenal News Article',
    }));
  } catch { /* ignore */ }

  // Fallback 3: Use the URL structure to guess slugs (return empty for admin to populate)
  console.warn('[Arsenal API] All fallback queries failed. Returning empty links.');
  return [];
}

/** Extracts article body content from Arsenal article pages via inline JSON data. */
export function extractArsenalArticleBody(html: string): string {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m || !m[1]) return '';

  let data: any;
  try { data = JSON.parse(m[1]); } catch (_e) { return ''; }

  const pp = (data.props || {}) as Record<string, unknown>;
  const pp2 = (pp.pageProps as Record<string, unknown>) || {};
  const article: any = pp2.article;
  if (!article) return '';

  const bodyBlocks = Array.isArray(article.articleBody) ? article.articleBody : [];
  if (bodyBlocks.length === 0) return '';

  const parts: string[] = [];

  for (const blk of bodyBlocks) {
    if (!blk || typeof blk !== 'object') continue;
    const typeStr = String(blk.type || '').toUpperCase();

    switch (typeStr) {
      case 'HEADER': {
        let titleRaw = String((blk as any).title || '');
        titleRaw = titleRaw.replace(/&amp;/g, '&').trim();
        const titleEscaped = escHtml(titleRaw);
        const author = escHtml(String((blk as any).author || ''));
        const dateStr = String((blk as any).date || '');

        if (titleRaw) parts.push(`<h1>${titleEscaped}</h1>`);
        if (author) parts.push(`<p class="article-byline">${author}</p>`);

        // Get hero image from block.image or first rendition
        let imgSrc: string | null = '';
        const blockImg = (blk as any).image;
        if (typeof blockImg === 'string' && blockImg.startsWith('http')) {
          imgSrc = blockImg;
        } else {
          const rends = Array.isArray((blk as any).renditions) ? (blk as any).renditions : [];
          let maxW = 0;
          for (const r of rends) {
            const w = Number((r as any)?.width || 0);
            if (w > maxW && (r as any)?.src) {
              maxW = w;
              imgSrc = String((r as any).src);
            }
          }
        }

        // Note: hero image is stored in article.heroImage and rendered separately by the frontend.
        // Do NOT include it in fullContent to avoid duplicate rendering.

        if (dateStr) {
          let date: Date | null = null;
          try { date = new Date(dateStr); } catch {}
          const formatted = date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            : escHtml(dateStr.substring(0, 16));
          parts.push(`<time datetime="${escHtml(dateStr)}" class="article-date">${formatted}</time>`);
        }
        break;
      }

      case 'TEXT': {
        const innerHtmlVal = String((blk as any).html || (blk as any).innerHTML || '').trim();
        const textContentVal = String(
          (blk as any).textContent ||
          (blk as any).innerText || ''
        ).trim();

        if (!innerHtmlVal && !textContentVal) continue;

        if (innerHtmlVal) {
          let tagName = String(blk.tagName ?? 'p').replace(/[^a-z]+/gi, '').toLowerCase() || 'p';
          const cleaned = innerHtmlVal.replace(/<script[\s\S]*?<\/script>/gi, '');
          parts.push(`<${tagName}>${cleaned}</${tagName}>`);
        } else if (textContentVal) {
          parts.push(`<p>${escHtml(textContentVal)}</p>`);
        }
        break;
      }

      case 'IMAGE': {
        let src = String((blk as any).src || '');
        if (!src.startsWith('http')) {
          const rends: any[] = (blk as any).renditions || [];
          for (let j = 0; j < rends.length; j++) {
            if ((rends[j] as any)?.width > 3 && (rends[j] as any).src) {
              src = String((rends[j] as any).src);
              break;
            }
          }
        }

        if (!src.startsWith('http') || src.length < 10) continue;

        // Store the image URL in contentImages (via scraper), but skip rendering
        // inline <figure> here to prevent duplication with the frontend contentImages grid.
        // If there's a caption, preserve it as text so it isn't lost entirely.
        const capText = String((blk as any).textContent || (blk as any).caption || '').trim();
        if (capText) {
          parts.push(`<p class="arsenal-image-caption"><em>${escHtml(capText)}</em></p>`);
        }
        break;
      }

      case 'LIST': {
        const tag = String((blk as any).tagName || 'UL').toUpperCase();
        const liTag = tag === 'OL' ? 'ol' : 'ul';
        
        const itemVals: any[] = (blk as any).items || [];
        if (itemVals.length === 0) continue;

        const itemParts: string[] = [];
        for (const itv of itemVals) {
          let entryHtml = '';
          
          // Check if the item has a linkUrl to wrap in <a>
          const lkUrl = String((itv as any)?.linkUrl || '');
          if (lkUrl && lkUrl.startsWith('http')) {
            const href = escHtml(lkUrl);
            const txt = escHtml(String(itv.textContent || ''));
            entryHtml = `<a href="${href}">${txt}</a>`;
          } else {
            const rawContent = String((itv as any)?.html || '').trim();
            if (rawContent) {
              entryHtml = escHtml(rawContent);
            } else {
              entryHtml = escHtml(String(itv.textContent || ''));
            }
          }

          itemParts.push(`<li>${entryHtml}</li>`);
        }

        parts.push(`<${liTag} class="arsenal-list">${itemParts.join('')}</${liTag}>`);
        break;
      }

      default: {
        if ((blk as any).textContent) {
          parts.push(`<p>${escHtml(String((blk as any).textContent))}</p>`);
        }
      }
    }
  }

  return parts.join('\n');
}

/** Extracts the hero / primary image URL from an Arsenal article page's JSON. */
export function extractArsenalHeroImage(html: string): string | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m || !m[1]) return null;

  let data: any;
  try { data = JSON.parse(m[1]); } catch (_e) { return null; }

  const pp = (data.props || {}) as Record<string, unknown>;
  const pp2 = (pp.pageProps as Record<string, unknown>) || {};
  const article: any = pp2.article;
  if (!article) return null;

  // promoImage field should be a direct URL string
  const imgVal = article.promoImage;
  if (typeof imgVal === 'string' && imgVal.startsWith('http')) {
    return imgVal;
  }

  /** Compare two image URLs — prefer XL landscape → large → xl_square → others */
  const rankUrl = (url: string): number => {
    if (/\/xl_landscape\//.test(url)) return 4;
    if (/\/large_/i.test(url)) return 3;
    if (/\/xl_square\//.test(url)) return 2;
    const w = Number(/\.width_(\d+)/.exec(url)?.[1] || 0);
    return w > 800 ? 2 : 1;
  };

  /* Collect all candidate images from body blocks, preferring XL renditions */
  let bestUrl: string | null = null;
  let bestRank = -1;

  const bodyBlocks = Array.isArray(article.articleBody) ? article.articleBody : [];
  for (const blk of bodyBlocks) {
    const bType = String(blk?.type || '').toUpperCase();
    
    if (bType === 'HEADER' || bType === 'IMAGE') {
      let checkUrl: string | null = blk?.type === 'HEADER'
        ? (blk as any).image
        : (blk as any).src;
      if (typeof checkUrl === 'string' && checkUrl.startsWith('http')) {
        const r = rankUrl(checkUrl);
        if (r > bestRank) { bestRank = r; bestUrl = checkUrl; }
      }

      // Also check renditions for XL versions
      const rends = blk?.renditions || [];
      if (Array.isArray(rends) && rends.length > 0) {
        for (const r of rends) { 
          const url = (r as any)?.src;
          if (url && typeof url === 'string' && url.startsWith('http')) {
            const rank = rankUrl(url);
            if (rank > bestRank) { bestRank = rank; bestUrl = url; }
          }
        }
      }
    }
  }

  // Last resort: get og:image meta tag from the raw HTML source 
  if (!bestUrl) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)>/i);
    if (ogMatch && ogMatch[1].startsWith('http')) return ogMatch[1];
  }

  return null;  
}

/** Escapes special HTML characters for safe attribute value output. */
export function escHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;') 
    .replace(/</g, '&lt;') 
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
