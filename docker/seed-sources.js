/**
 * Seeds the scraping sources.
 *
 *   docker exec -i harbingermongo mongosh --quiet news-aggregator < docker/seed-sources.js
 *
 * Upserts by name, so it is safe to re-run: existing sources are updated in
 * place and articles are never dropped. Site-specific adapters need no CSS
 * selectors — they know their own page structure.
 */
const sources = [
  {
    name: 'Arsenal News',
    displayName: 'Arsenal',
    baseUrl: 'https://www.arsenal.com/news',
    adapter: 'arsenal',
    // One source covers every section: Arsenal's sitemap is not split by
    // section, and each article carries its own taxonomy as its category.
    articleLimit: 20,
  },
  {
    name: 'RSI Comm-Link',
    displayName: 'Star Citizen News',
    baseUrl: 'https://robertsspaceindustries.com/comm-link',
    adapter: 'rsi-commlink',
    // Comm-Link mixes articles with store/promo pages carrying no prose; only
    // ~45% of listings are articles. A higher ceiling on candidates keeps the
    // yield near 20 actual articles.
    articleLimit: 45,
  },
];

for (const source of sources) {
  db.sources.updateOne(
    { name: source.name },
    {
      $set: Object.assign({}, source, {
        articleLinkSelector: '',
        contentSelector: '',
        titleSelector: '',
        imageSelector: '',
        isActive: true,
        updatedAt: new Date(),
      }),
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

print('Seeded ' + sources.length + ' source(s):');
db.sources.find({}, { name: 1, displayName: 1, adapter: 1, articleLimit: 1 }).forEach(function (d) {
  print('  - ' + d.name + ' (' + d.displayName + ') via ' + d.adapter + ', limit ' + d.articleLimit);
});
