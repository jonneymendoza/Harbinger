const sources = [
  { name: "Arsenal News", baseUrl: "https://www.arsenal.com/news/men", articleLinkSelector: "a[href*='/news/']", contentSelector: "article .ArticleContent__content__x3j6r", titleSelector: "h1.article-title", imageSelector: "img.article-hero-image", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { name: "Arsenal Women", baseUrl: "https://www.arsenal.com/news/women", articleLinkSelector: "a[href*='/news/']", contentSelector: "article .ArticleContent__content__x3j6r", titleSelector: "h1.article-title", imageSelector: "img.article-hero-image", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { name: "Arsenal Club", baseUrl: "https://www.arsenal.com/news/club", articleLinkSelector: "a[href*='/news/']", contentSelector: "article .ArticleContent__content__x3j6r", titleSelector: "h1.article-title", imageSelector: "img.article-hero-image", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { name: "Arsenal Academy", baseUrl: "https://www.arsenal.com/news/academy", articleLinkSelector: "a[href*='/news/']", contentSelector: "article .ArticleContent__content__x3j6r", titleSelector: "h1.article-title", imageSelector: "img.article-hero-image", isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

db.sources.drop();
db.articles.drop();

const result = db.sources.insertMany(sources);
print("Seeded " + sources.length + " sources");
db.sources.find().forEach(d => print(`  - ${d.name}: ${d.baseUrl}`));
