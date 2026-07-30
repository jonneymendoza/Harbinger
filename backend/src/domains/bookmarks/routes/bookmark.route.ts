import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/appError';
import { authMiddleware, checkRole } from '@infrastructure/middleware/authMiddleware';
import { AuthPayload } from '@infrastructure/auth/jwtService';
import {
  IBookmarkRepository,
  isValidId,
} from '@domains/bookmarks/interfaces/IBookmarkRepository';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const currentUser = (req: Request): AuthPayload => (req as any).user as AuthPayload;

/**
 * Bookmark routes, per `specs/api-endpoints.md §4`. Mounted at /api/bookmarks.
 *
 * The repository is injected so these routes can be exercised without Mongo —
 * every bug this replaced was a contract bug (path, status code, response
 * shape), which is exactly what a stubbed repository lets us assert.
 *
 * Auth is delegated: `authMiddleware` turns a missing or invalid token into 401,
 * and `checkRole(['USER','ADMIN'])` turns a guest token into 403. Hand-rolling
 * this previously returned 403 for both, contradicting the error map in §6.
 */
export function createBookmarkRouter(repository: IBookmarkRepository): Router {
  const router = Router();

  // Applies to every route below, mutations included — a guest could
  // previously still reach DELETE.
  router.use(authMiddleware, checkRole(['USER', 'ADMIN']));

  /**
   * GET /api/bookmarks
   * Paginated list, same shape as GET /api/news.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_SIZE),
      );

      const { articles, totalArticles } = await repository.findByUser(
        currentUser(req).sub,
        page,
        limit,
      );

      res.json({
        success: true,
        data: {
          articles,
          totalArticles,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.max(1, Math.ceil(totalArticles / limit)),
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/bookmarks/ids
   * Just the bookmarked article ids, so the feed can mark cards without
   * fetching every article. Declared before /:id-shaped routes.
   */
  router.get('/ids', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ids = await repository.listIds(currentUser(req).sub);
      res.json({ success: true, data: { ids }, error: null });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/bookmarks
   * Body: { articleId }
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const articleId = typeof req.body?.articleId === 'string' ? req.body.articleId.trim() : '';

      if (!articleId) {
        return next(AppError.badRequest('Missing required field: articleId'));
      }
      if (!isValidId(articleId)) {
        return next(AppError.badRequest('Invalid article ID format'));
      }
      if (!(await repository.articleExists(articleId))) {
        return next(AppError.notFound('Article not found'));
      }

      // Idempotent: bookmarking twice is a success, not a conflict.
      const added = await repository.add(currentUser(req).sub, articleId);

      res.status(201).json({
        success: true,
        data: { articleId, bookmarked: true, alreadyBookmarked: !added },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/bookmarks/:id
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const articleId = String(req.params.id);

      if (!isValidId(articleId)) {
        return next(AppError.badRequest('Invalid article ID format'));
      }

      const removed = await repository.remove(currentUser(req).sub, articleId);
      if (!removed) {
        return next(AppError.notFound('Bookmark not found'));
      }

      res.json({ success: true, data: { articleId, bookmarked: false }, error: null });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/bookmarks
   * Clears every bookmark for the user.
   */
  router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await repository.clear(currentUser(req).sub);
      res.json({ success: true, data: { cleared: true }, error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
