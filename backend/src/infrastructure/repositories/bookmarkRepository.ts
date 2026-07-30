import mongoose from 'mongoose';
import ArticleModel from '@domains/news/models/Article';
import { User } from '@domains/auth/models/User';
import {
  BookmarkPage,
  IBookmarkRepository,
} from '@domains/bookmarks/interfaces/IBookmarkRepository';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

/**
 * Bookmarks are stored as an array of article ids on the user document, so
 * reads join back to `articles` to build the listing.
 */
export class BookmarkRepository implements IBookmarkRepository {
  async findByUser(userId: string, page: number, limit: number): Promise<BookmarkPage> {
    const user = await User.findById(userId).select('bookmarks').lean();
    const ids = user?.bookmarks ?? [];

    if (ids.length === 0) {
      return { articles: [], totalArticles: 0 };
    }

    const filter = { _id: { $in: ids } };

    // Count the matching articles rather than the id list: a bookmark whose
    // article was later removed must not inflate the total.
    const [docs, totalArticles] = await Promise.all([
      ArticleModel.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sourceId', 'name')
        .lean(),
      ArticleModel.countDocuments(filter),
    ]);

    return {
      totalArticles,
      articles: (docs as any[]).map((a) => ({
        id: String(a._id),
        title: a.title,
        thumbnailImage: a.thumbnailImage ?? null,
        summary: a.summary ?? '',
        publishedAt: a.publishedAt,
        sourceName: a.sourceId?.name || a.sourceName || 'Unknown',
      })),
    };
  }

  async articleExists(articleId: string): Promise<boolean> {
    return (await ArticleModel.exists({ _id: toObjectId(articleId) })) !== null;
  }

  // Both mutations detect "did anything change?" through the query filter
  // rather than modifiedCount. The User schema sets `timestamps: true`, so
  // Mongoose adds updatedAt to every update and modifiedCount is 1 whenever
  // the document matched — even when $addToSet or $pull changed nothing.

  async add(userId: string, articleId: string): Promise<boolean> {
    const articleObjectId = toObjectId(articleId);
    // Matches only if the bookmark is absent; null means it was already there.
    const result = await User.findOneAndUpdate(
      { _id: toObjectId(userId), bookmarks: { $ne: articleObjectId } },
      { $addToSet: { bookmarks: articleObjectId } },
    );
    return result !== null;
  }

  async remove(userId: string, articleId: string): Promise<boolean> {
    const articleObjectId = toObjectId(articleId);
    // Matches only if the bookmark is present; null means there was nothing
    // to remove, which the route reports as 404.
    const result = await User.findOneAndUpdate(
      { _id: toObjectId(userId), bookmarks: articleObjectId },
      { $pull: { bookmarks: articleObjectId } },
    );
    return result !== null;
  }

  async clear(userId: string): Promise<void> {
    await User.updateOne({ _id: toObjectId(userId) }, { $set: { bookmarks: [] } });
  }

  async listIds(userId: string): Promise<string[]> {
    const user = await User.findById(userId).select('bookmarks').lean();
    return (user?.bookmarks ?? []).map((id) => String(id));
  }
}
