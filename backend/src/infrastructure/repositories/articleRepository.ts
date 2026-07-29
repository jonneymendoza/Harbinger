import mongoose from 'mongoose';
import ArticleModel, { IArticle } from '@domains/news/models/Article';
import { Article, ArticleInput, ArticleQuery, IArticleRepository } from '@domains/news/interfaces/IArticleRepository';

export class ArticleRepository implements IArticleRepository {
  async upsert(input: ArticleInput): Promise<Article | null> {
    const result = await ArticleModel.findOneAndUpdate(
      { sourceUrl: input.sourceUrl },
      { $set: { ...input, scrapedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return (result as unknown as Article) || null;
  }

  async findById(id: string): Promise<Article | null> {
    const article = await ArticleModel.findById(id).populate('sourceId', 'name').lean();
    return (article as unknown as Article) || null;
  }

  async findBySourceUrl(sourceUrl: string): Promise<Article | null> {
    const article = await ArticleModel.findOne({ sourceUrl }).populate('sourceId', 'name').lean();
    return (article as unknown as Article) || null;
  }

  async findAll(query?: ArticleQuery): Promise<{ articles: Article[]; total: number; page: number; totalPages: number }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      ArticleModel.find()
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sourceId', 'name')
        .lean(),
      ArticleModel.countDocuments(),
    ]);

    return {
      articles: articles as unknown as Article[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySourceId(sourceId: string): Promise<Article[]> {
    const articles = await ArticleModel.find({ sourceId })
      .sort({ publishedAt: -1 })
      .lean();
    return articles as unknown as Article[];
  }

  async delete(id: string): Promise<boolean> {
    const result = await ArticleModel.findByIdAndDelete(id);
    return result !== null;
  }

  async countBySourceId(sourceId: string): Promise<number> {
    return ArticleModel.countDocuments({ sourceId });
  }

  async findNewArticlesSince(sourceId: string, since: Date): Promise<Article[]> {
    const articles = await ArticleModel.find({
      sourceId,
      scrapedAt: { $gte: since },
    }).sort({ publishedAt: -1 }).lean();
    return articles as unknown as Article[];
  }
}
