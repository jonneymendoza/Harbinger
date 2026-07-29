/**
 * Extracts article body content from Arsenal article pages via Next.js inline JSON data.
 *
 * Block types: 'HEADER', 'TEXT', 'IMAGE', 'LIST'
 *   HEADER: image(URL), title, author, date, renditions[]
 *   TEXT: textContent, innerHTML, tagName (P/H2/H3/etc.)
 *   IMAGE: src(URL), caption, renditions[]  
 *   LIST: items[], tagName (OL/UL)
 */

export function extractArsenalArticleBody(html: string): string {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!m || !m[1]) return '';
  
  let data: any;
  try { data = JSON.parse(m[1]); } catch (_e) { return ''; }

  const pp = (data.props || {}) as Record<string, unknown>;
  const pp2 = pp?.pageProps as Record<string, unknown> | null;
  const article: any = pp2?.article;
  if (!article) return '';
  
  const bodyBlocks = (article.articleBody || []) as Array<Record<string, unknown>>;
  if (bodyBlocks.length === 0) return '';

  const parts: string[] = [];

  for (const blk of bodyBlocks) {
    if (!blk || typeof blk !== 'object') continue;
    const typeStr = String(blk.type || '').toUpperCase();

    switch (typeStr) {
      case 'HEADER': {
        // The title, hero image and date are stored as dedicated article
        // fields and rendered by the frontend's own header. Emitting them
        // here too would show each of them twice on the page.
        const author = escHtml(String((blk as any).author || '').trim());
        if (author) parts.push(`<p class="article-byline">${author}</p>`);
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
          const cleaned = innerHtmlVal.replace(/<script[\s\S]*?<\/script>/gi, '');
          // Arsenal's `html` field already carries its own wrapper element, so
          // adding another produces invalid nesting like <p><p>…</p></p>.
          if (/^\s*</.test(cleaned)) {
            parts.push(cleaned);
          } else {
            const tagName = String(blk.tagName ?? 'p').replace(/[^a-z]+/gi, '').toLowerCase() || 'p';
            parts.push('<' + tagName + '>' + cleaned + '</' + tagName + '>');
          }
        } else if (textContentVal) {
          parts.push('<p>' + escHtml(textContentVal) + '</p>');
        }
        break;
      }

      case 'IMAGE': {
        let src = String((blk as any).src || '');
        if (!src.startsWith('http')) {
          const rends = (blk as any).renditions || [];
          for (let j = 0; j < rends.length; j++) {
            if ((rends[j] as any)?.width > 3 && (rends[j] as any).src) {
              src = String((rends[j] as any).src); 
              break;
            }
          }
        }

        if (!src.startsWith('http') || src.length < 10) continue;

        // Store the image URL in contentImages (via scraper), but skip rendering inline
        // <figure> here to prevent duplication with the frontend contentImages grid.
        // If there's a caption, preserve it as text so context isn't lost entirely.
        const capText = String((blk as any).textContent || (blk as any).caption || '').trim();
        if (capText)
          parts.push('<p class="arsenal-image-caption"><em>' + escHtml(capText) + '</em></p>');

        break;
      }

      case 'LIST': {
        const tag = String((blk as any).tagName || 'UL').toUpperCase();
        const liTag = tag === 'OL' ? 'ol' : 'ul';
        
        const itemVals = (blk as any).items || [];
        if (!Array.isArray(itemVals) || itemVals.length === 0) continue;

        const itemParts: string[] = []; 
        for (const itv of itemVals) {
          let entryHtml = '';
          
          // Check if the item has a linkUrl to wrap in <a>
          const lkUrl = String((itv as any)?.linkUrl || '');
          if (lkUrl && lkUrl.startsWith('http')) {
            const href = escHtml(lkUrl);
            const txt = escHtml(String(itv.textContent || ''));
            entryHtml = '<a href="' + href + '">' + txt + '</a>';
          } else {
            // Use raw HTML content or plain-text fallback. Escaping the HTML
            // here would render the markup as visible text.
            const rawContent = String((itv as any)?.html || '').trim();
            if (rawContent) {
              entryHtml = rawContent.replace(/<script[\s\S]*?<\/script>/gi, '');
            } else {
              const txt = String(itv.textContent || '');
              entryHtml = escHtml(txt);
            }
          }

          itemParts.push('<li>' + entryHtml + '</li>');
        }

        parts.push('<' + liTag + ' class="arsenal-list">' + itemParts.join('') + '</' + liTag + '>');
        break;
      }

      default: {
        if ((blk as any).textContent) {
          parts.push('<p>' + escHtml(String((blk as any).textContent)) + '</p>');
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Extracts the hero / primary image URL from an Arsenal article page's JSON.
 *
 * Prefers XL landscape renditions (largest) over smaller thumbnails.
 */
export function extractArsenalHeroImage(html: string): string | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!m || !m[1]) return null;

  let data: any;
  try { data = JSON.parse(m[1]); } catch (_e) { return null; }

  const pp = (data.props || {}) as Record<string, unknown>;
  const pp2 = pp.pageProps as Record<string, unknown> | null;
  const article: any = pp2?.article;
  if (!article) return null;

  /** Compare two image URLs — prefer XL landscape → large → xl_square → others */
  const rankUrl = (url: string): number => {
    if (/\/xl_landscape\//.test(url)) return 4;
    if (/\/large_/i.test(url)) return 3;
    if (/\/xl_square\//.test(url)) return 2;
    const w = Number(/\.width_(\d+)/.exec(url)?.[1] || 0);
    return w > 800 ? 2 : 1;
  };

  /** promoImage is the official primary image — use it first */
  const imgVal = article.promoImage;
  if (typeof imgVal === 'string' && imgVal.startsWith('http')) {
    return imgVal;
  }

  /* Collect all candidate images from body blocks, preferring XL renditions */
  let bestUrl: string | null = null;
  let bestRank = -1;

  const bodyBlocks = article.articleBody || [];
  if (Array.isArray(bodyBlocks)) {
    for (const blk of bodyBlocks) {
      const bType = String(blk?.type || '').toUpperCase();
      if (bType === 'HEADER' || bType === 'IMAGE') {
        // Check single-image fields
        let checkUrl: string | null = null;
        if (bType === 'HEADER') {
          checkUrl = (blk as any).image;
        } else {
          checkUrl = (blk as any).src;
        }
        if (typeof checkUrl === 'string' && checkUrl.startsWith('http')) {
          const r = rankUrl(checkUrl);
          if (r > bestRank) { bestRank = r; bestUrl = checkUrl; }
        }

        // Check renditions for the largest / XL version
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
  }

  // Last resort: fallback to og:image meta tag
  if (!bestUrl) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)>/i);
    if (ogMatch && ogMatch[1].startsWith('http')) return ogMatch[1];
  }

  return bestUrl;
}

/** Escapes special HTML characters for safe attribute value output. */
export function escHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/\u0026/g, '&amp;') 
    .replace(/</g, '&lt;') 
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
