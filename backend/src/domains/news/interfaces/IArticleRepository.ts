import { Types } from 'mongoose';

export interface Article {
  _id: Types.ObjectId;
  sourceId: Types.ObjectId;
  sourceName: string;
  sourceUrl: string;
  title: string;
  heroImage: string | null;
  thumbnailImage: string | null;
  contentImages: string[];
  fullContent: string;
  summary: string;
  category: string | null;
  publishedAt: Date;
  scrapedAt: Date;
}

export interface ArticleInput {
  sourceId: Types.ObjectId;
  sourceName: string;
  sourceUrl: string;
  title: string;
  heroImage: string | null;
  thumbnailImage: string | null;
  contentImages: string[];
  fullContent: string;
  summary: string;
  category: string | null;
  publishedAt: Date;
}

export interface ArticleQuery {
  page?: number;
  limit?: number;
}

export interface IArticleRepository {
  upsert(input: ArticleInput): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  findAll(query?: ArticleQuery): Promise<{ articles: Article[]; total: number; page: number; totalPages: number }>;
  findBySourceUrl(sourceUrl: string): Promise<Article | null>;
  countBySourceId(sourceId: string): Promise<number>;
}
