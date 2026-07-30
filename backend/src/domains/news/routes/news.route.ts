import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ArticleModel from '@domains/news/models/Article';
import SourceModel from '@domains/news/models/Source';
import { AppError } from '@shared/errors/appError';

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/news/sources
 * Active sources that have articles, for building feed filters. Public: the
 * feed itself is public, so the filter list has to be too.
 *
 * Registered before `/:id` — otherwise that route captures "sources".
 */
router.get('/sources', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [sources, counts] = await Promise.all([
      SourceModel.find({ isActive: true }, 'name displayName').sort({ name: 1 }).lean(),
      ArticleModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $group: { _id: '$sourceId', count: { $sum: 1 } } },
      ]),
    ]);

    const countBySource = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
      success: true,
      data: {
        sources: sources
          .map((s) => ({
            id: String(s._id),
            name: s.name,
            label: s.displayName || s.name,
            articleCount: countBySource.get(String(s._id)) ?? 0,
          }))
          // A source with nothing scraped yet would be a filter that returns
          // an empty feed, so leave it out until it has content.
          .filter((s) => s.articleCount > 0),
        totalArticles: await ArticleModel.countDocuments(),
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/news
 * Fetch a paginated list of recent articles, optionally filtered by source.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Clamp both: a negative page yields a negative skip (which Mongo rejects)
    // and an unbounded limit lets one request read the whole collection.
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    // `source` is a source id; an unrecognised value is rejected rather than
    // silently returning the unfiltered feed.
    const sourceParam = typeof req.query.source === 'string' ? req.query.source.trim() : '';
    if (sourceParam && !mongoose.Types.ObjectId.isValid(sourceParam)) {
      return next(AppError.badRequest('Invalid source filter'));
    }
    const filter = sourceParam ? { sourceId: new mongoose.Types.ObjectId(sourceParam) } : {};

    const [articles, total] = await Promise.all([
      ArticleModel.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sourceId', 'name')
        .lean(),
      ArticleModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        articles: (articles as any[]).map((a: any) => ({
          id: a._id.toString(),
          title: a.title,
          thumbnailImage: a.thumbnailImage,
          summary: a.summary,
          publishedAt: a.publishedAt,
          // Fall back to the denormalised copy so a deleted source does not
          // turn every one of its articles into "Unknown" — matching /:id.
          sourceName: a.sourceId?.name || a.sourceName || 'Unknown',
        })),
        totalArticles: total,
        currentPage: page,
        pageSize: limit,
        // Always at least 1 so an empty feed still reads as "page 1 of 1".
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/news/:id
 * Fetch full article content.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(AppError.badRequest('Invalid article ID'));
    }

    const article = await ArticleModel.findById(id)
      .populate('sourceId', 'name baseUrl')
      .lean();

    if (!article) {
      return next(AppError.notFound('Article not found'));
    }

    res.json({
      success: true,
      data: {
        id: article._id.toString(),
        title: article.title,
        heroImage: article.heroImage,
        thumbnailImage: article.thumbnailImage,
        contentImages: article.contentImages,
        fullContent: article.fullContent,
        // summary is the frontend's fallback when fullContent is empty (media-only
        // posts), and sourceName labels the "view original" link — both must be sent.
        summary: article.summary,
        sourceName: (article.sourceId as any)?.name || article.sourceName || 'Unknown',
        sourceUrl: article.sourceUrl,
        category: article.category,
        publishedAt: article.publishedAt,
        scrapedAt: article.scrapedAt,
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
