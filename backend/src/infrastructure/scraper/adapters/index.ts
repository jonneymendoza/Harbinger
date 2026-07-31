import { AdapterDescriptor, ISourceAdapter } from '@domains/news/interfaces/ISourceAdapter';
import { Source } from '@domains/news/interfaces/ISourceRepository';
import { GenericAdapter } from './genericAdapter';
import { ArsenalAdapter } from './arsenalAdapter';
import { RsiCommLinkAdapter } from './rsiCommLinkAdapter';
import { RssAdapter } from './rssAdapter';
import { SitemapAdapter } from './sitemapAdapter';

/**
 * Registry of scraping adapters.
 *
 * A source picks its adapter by key, stored on the source document, so adding
 * a source through the admin UI never requires a code change. Site-specific
 * adapters are optimisations for sources we know well; `generic` is the
 * fallback and the default for anything an operator adds.
 */
// `rss` before `generic`: it needs no selectors and suits most news sites,
// so it is the better default suggestion when both could apply.
// Ordered by how durable each strategy is: a feed carries structured content
// and survives redesigns, a sitemap gives reliable discovery, selectors break
// whenever markup changes. The picker shows them in this order.
const ADAPTERS: ISourceAdapter[] = [
  new ArsenalAdapter(),
  new RsiCommLinkAdapter(),
  new RssAdapter(),
  new SitemapAdapter(),
  new GenericAdapter(),
];

export const DEFAULT_ADAPTER_KEY = 'generic';

const byKey = new Map<string, ISourceAdapter>(ADAPTERS.map((a) => [a.descriptor.key, a]));

/** Every adapter's self-description, for the admin UI's adapter picker. */
export function listAdapters(): AdapterDescriptor[] {
  return ADAPTERS.map((a) => ({ ...a.descriptor }));
}

export function getAdapter(key: string | undefined | null): ISourceAdapter {
  if (!key) return byKey.get(DEFAULT_ADAPTER_KEY)!;
  const adapter = byKey.get(key);
  if (!adapter) {
    console.warn(`[adapters] Unknown adapter "${key}", falling back to "${DEFAULT_ADAPTER_KEY}"`);
    return byKey.get(DEFAULT_ADAPTER_KEY)!;
  }
  return adapter;
}

export function isKnownAdapter(key: string): boolean {
  return byKey.has(key);
}

export function resolveAdapterForSource(source: Source): ISourceAdapter {
  return getAdapter((source as Source & { adapter?: string }).adapter);
}

/**
 * Suggests the adapter best suited to a URL, used by the admin UI to
 * preselect a sensible option when an operator pastes a link.
 */
export function suggestAdapterForUrl(url: string): AdapterDescriptor {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ...byKey.get(DEFAULT_ADAPTER_KEY)!.descriptor };
  }

  const match = ADAPTERS.find((a) => a.descriptor.hostPattern?.test(host));
  return { ...(match ?? byKey.get(DEFAULT_ADAPTER_KEY)!).descriptor };
}

export { GenericAdapter, ArsenalAdapter, RsiCommLinkAdapter, RssAdapter, SitemapAdapter };
