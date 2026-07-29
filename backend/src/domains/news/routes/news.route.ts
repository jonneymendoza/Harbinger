import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ArticleModel from '@domains/news/models/Article';
import { AppError } from '@shared/errors/appError';

const router = Router();

/**
 * GET /api/news
 * Fetch a paginated list of recent articles.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
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

    res.json({
      success: true,
      data: {
        articles: (articles as any[]).map((a: any) => ({
          id: a._id.toString(),
          title: a.title,
          thumbnailImage: a.thumbnailImage,
          summary: a.summary,
          publishedAt: a.publishedAt,
          sourceName: a.sourceId?.name || 'Unknown',
        })),
        totalArticles: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
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
