import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { verifyToken, AuthPayload } from '@infrastructure/auth/jwtService';

const router = Router();

// Validate MongoDB ObjectId format
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Extract and validate auth token from request */
function extractAuth(req: Request): AuthPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.slice(7);
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * GET /api/bookmarks
 * Fetch all articles bookmarked by the authenticated user.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.sub) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Authentication required', code: 'FORBIDDEN' },
      });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    // Get user's bookmark article IDs
    const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(auth.sub) });
    if (!user || !user.bookmarks || user.bookmarks.length === 0) {
      return res.json({ success: true, data: [], error: null });
    }

    // Populate article details from bookmarks
    const articles = await db.collection('articles')
      .find({ _id: { $in: user.bookmarks.map((id: any) => new mongoose.Types.ObjectId(id)) } })
      .sort({ publishedAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: articles,
      error: null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to fetch bookmarks', code: 'BOOKMARK_FETCH_ERROR' },
    });
  }
});

/**
 * POST /api/bookmarks/:articleId
 * Add an article to the user's bookmark list.
 */
router.post('/:articleId', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Authentication required', code: 'FORBIDDEN' },
      });
    }

    // Reject guest users from bookmarking
    if (auth.role === 'GUEST') {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Please create an account to save bookmarks', code: 'GUEST_UPGRADE_REQUIRED' },
      });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const articleIdStr = Array.isArray(req.params.articleId) ? req.params.articleId[0] : req.params.articleId;
    
    // Validate article ID format
    let articleId: any;
    try {
      articleId = new mongoose.Types.ObjectId(articleIdStr);
      if (!articleId) throw new Error();
    } catch {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid article ID format', code: 'INVALID_ID' },
      });
    }

    // Verify the article exists
    const article = await db.collection('articles').findOne({ _id: articleId });
    if (!article) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'Article not found', code: 'ARTICLE_NOT_FOUND' },
      });
    }

    // Add bookmark (idempotent — $addToSet doesn't duplicate)
    const result = await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(auth.sub) },
      { $addToSet: { bookmarks: articleId } }
    );

    return res.json({
      success: true,
      data: { bookmarked: result.modifiedCount > 0 },
      error: null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to bookmark article', code: 'BOOKMARK_POST_ERROR' },
    });
  }
});

/**
 * DELETE /api/bookmarks/:articleId
 * Remove an article from the user's bookmarks.
 */
router.delete('/:articleId', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.sub) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Authentication required', code: 'FORBIDDEN' },
      });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const articleIdStr = Array.isArray(req.params.articleId) ? req.params.articleId[0] : req.params.articleId;
    
    let articleId: any;
    try {
      articleId = new mongoose.Types.ObjectId(articleIdStr);
    } catch {
      return res.status(400).json({
        success: false,
        data: null,
        error: { message: 'Invalid article ID format', code: 'INVALID_ID' },
      });
    }

    const result = await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(auth.sub) },
      { $pull: { bookmarks: articleId } }
    );

    return res.json({
      success: true,
      data: { bookmarkRemoved: result.modifiedCount > 0 },
      error: null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to remove bookmark', code: 'BOOKMARK_DELETE_ERROR' },
    });
  }
});

/**
 * DELETE /api/bookmarks
 * Clear all bookmarks for the authenticated user.
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.sub) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { message: 'Authentication required', code: 'FORBIDDEN' },
      });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(auth.sub) },
      { $set: { bookmarks: [] } }
    );

    return res.json({
      success: true,
      data: { cleared: true },
      error: null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to clear bookmarks', code: 'BOOKMARK_CLEAR_ERROR' },
    });
  }
});

export default router;
