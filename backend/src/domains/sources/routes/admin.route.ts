import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SourceInput } from '@domains/news/interfaces/ISourceRepository';
import { AppError } from '@shared/errors/appError';
import { PlaywrightScraper } from '@infrastructure/scraper/playwrightScraper';
import {
  DEFAULT_ADAPTER_KEY,
  isKnownAdapter,
  listAdapters,
  suggestAdapterForUrl,
} from '@infrastructure/scraper/adapters';
import { runScrapeNow } from '@cron/scraperCron';

const router = Router();

/**
 * GET /api/admin/sources/adapters
 * Lists the available scraping adapters so the admin UI can render its picker
 * and know which adapters need CSS selectors. Optionally suggests one for a
 * candidate URL via ?url=.
 */
router.get('/adapters', (req: Request, res: Response) => {
  const url = typeof req.query.url === 'string' ? req.query.url : undefined;

  res.json({
    success: true,
    data: {
      adapters: listAdapters().map(({ hostPattern, ...rest }) => rest),
      defaultAdapter: DEFAULT_ADAPTER_KEY,
      suggested: url ? suggestAdapterForUrl(url).key : null,
    },
    error: null,
  });
});

/**
 * GET /api/admin/sources
 * List all configured scraping targets.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const sources = await db.collection('sources').find({}).sort({ createdAt: -1 }).toArray();

    res.json({
      success: true,
      data: sources,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/sources
 * Add a new target website for the scraper to track.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const { name, baseUrl, articleLinkSelector, contentSelector, titleSelector, imageSelector, isActive } = req.body as SourceInput;
    const adapter = (req.body as SourceInput).adapter || DEFAULT_ADAPTER_KEY;

    if (!name || !baseUrl) {
      return next(AppError.badRequest('Missing required fields: name, baseUrl'));
    }

    if (!isKnownAdapter(adapter)) {
      return next(AppError.badRequest(
        `Unknown adapter "${adapter}". Valid adapters: ${listAdapters().map(a => a.key).join(', ')}`,
      ));
    }

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      return next(AppError.badRequest('Invalid URL format for baseUrl'));
    }

    // Only the selector-driven adapter needs selectors; site-specific
    // adapters know their own page structure.
    const needsSelectors = listAdapters().find(a => a.key === adapter)?.requiresSelectors;
    if (needsSelectors && (!articleLinkSelector || !contentSelector)) {
      return next(AppError.badRequest(
        `Adapter "${adapter}" requires articleLinkSelector and contentSelector`,
      ));
    }

    const result = await db.collection('sources').insertOne({
      name,
      baseUrl,
      adapter,
      articleLinkSelector: articleLinkSelector || '',
      contentSelector: contentSelector || '',
      titleSelector: titleSelector || '',
      imageSelector: imageSelector || '',
      isActive: isActive ?? true,
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: { insertedId: result.insertedId },
      error: null,
    });
  } catch (error) {
    // Handle duplicate URL error
    if ((error as any).code === 11000) {
      return next(AppError.badRequest('A source with this baseUrl already exists'));
    }
    next(error);
  }
});

/**
 * PUT /api/admin/sources/:id
 * Update a source's configuration.
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(AppError.badRequest('Invalid source ID format'));
    }

    const updateFields: Partial<SourceInput> = {};
    const allowedFields: (keyof SourceInput)[] = ['name', 'baseUrl', 'adapter', 'articleLinkSelector', 'contentSelector', 'titleSelector', 'imageSelector', 'isActive'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    if (updateFields.adapter && !isKnownAdapter(updateFields.adapter)) {
      return next(AppError.badRequest(
        `Unknown adapter "${updateFields.adapter}". Valid adapters: ${listAdapters().map(a => a.key).join(', ')}`,
      ));
    }

    // Validate URL if baseUrl is being updated
    if (updateFields.baseUrl) {
      try {
        new URL(updateFields.baseUrl);
      } catch {
        return next(AppError.badRequest('Invalid URL format for baseUrl'));
      }
    }

    const result = await db.collection('sources').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return next(AppError.notFound('Source not found'));
    }

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    if ((error as any).code === 11000) {
      return next(AppError.badRequest('A source with this baseUrl already exists'));
    }
    next(error);
  }
});

/**
 * DELETE /api/admin/sources/:id
 * Remove a target website.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(AppError.badRequest('Invalid source ID format'));
    }

    const result = await db.collection('sources').deleteOne({ _id: new mongoose.Types.ObjectId(id) });

    if (result.deletedCount === 0) {
      return next(AppError.notFound('Source not found'));
    }

    res.json({
      success: true,
      data: { deletedId: id },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/sources/:id/toggle
 * Toggle a source's active/inactive status.
 */
router.patch('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(AppError.badRequest('Invalid source ID format'));
    }

    // Flipping a boolean from its own current value needs an aggregation
    // pipeline; a plain $set would store the literal { $not: ... } object.
    const result = await db.collection('sources').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      [{ $set: { isActive: { $not: '$isActive' } } }],
      { returnDocument: 'after' }
    );

    if (!result) {
      return next(AppError.notFound('Source not found'));
    }

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/sources/test
 * Dry-run the scrape of a single URL using a candidate adapter/selector set.
 */
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  const { url } = req.body ?? {};

  if (!url) {
    return next(AppError.badRequest('Missing required field: url'));
  }
  try {
    new URL(url);
  } catch {
    return next(AppError.badRequest('Invalid URL format'));
  }

  const scraper = new PlaywrightScraper();
  try {
    const result = await scraper.scrapeArticle(url, {
      name: req.body.name || 'Test Source',
      baseUrl: url,
      adapter: req.body.adapter || 'generic',
      articleLinkSelector: req.body.articleLinkSelector || '',
      contentSelector: req.body.contentSelector || '',
      titleSelector: req.body.titleSelector || '',
      imageSelector: req.body.imageSelector || '',
      isActive: true,
      _id: {} as any,
    } as any);

    if (!result) {
      return next(AppError.badRequest('Failed to scrape the provided URL with the given configuration'));
    }

    res.json({
      success: true,
      data: {
        title: result.title,
        heroImage: result.heroImage,
        fullContent: result.fullContent,
        summary: result.summary,
        contentImages: result.contentImages,
        publishedAt: result.publishedAt,
        category: result.category,
      },
      error: null,
    });
  } catch (error) {
    next(error);
  } finally {
    await scraper.destroy();
  }
});

/**
 * POST /api/admin/sources/run-scraper
 * Manually trigger the scraper pipeline.
 */
router.post('/run-scraper', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await runScrapeNow();
    res.json({
      success: true,
      data: results,
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
