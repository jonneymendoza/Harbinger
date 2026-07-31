import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
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
import { ScrapeRunRepository } from '@infrastructure/repositories/scrapeRunRepository';
import { discoverFeeds } from '@infrastructure/scraper/rss/feedDiscovery';

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
 * GET /api/admin/sources/discover-feeds?url=
 *
 * Probes a site for RSS/Atom feeds and reports what it found, so the operator
 * picks one rather than hunting for the path — or discovers there is none and
 * falls back to CSS selectors.
 *
 * Deliberately a suggestion, not an automatic choice: most sites publish
 * several feeds, and silently picking one would leave a source quietly carrying
 * the wrong content with nothing on screen to explain why.
 */
router.get('/discover-feeds', async (req: Request, res: Response, next: NextFunction) => {
  const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  if (!url) {
    return next(AppError.badRequest('Missing required query parameter: url'));
  }
  try {
    new URL(url);
  } catch {
    return next(AppError.badRequest('Invalid URL format'));
  }

  const scraper = new PlaywrightScraper();
  try {
    // Plain HTTP throughout: feeds are static XML, and a site that blocks the
    // rendered page often still serves its feed.
    const feeds = await discoverFeeds(url, (target) => scraper.fetchHtml(target));

    res.json({
      success: true,
      data: {
        feeds,
        recommendedAdapter: feeds.length > 0 ? 'rss' : 'generic',
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
    const articleLimit = (req.body as SourceInput).articleLimit;

    if (!name || !baseUrl) {
      return next(AppError.badRequest('Missing required fields: name, baseUrl'));
    }

    if (articleLimit !== undefined && (!Number.isInteger(articleLimit) || articleLimit < 1 || articleLimit > 200)) {
      return next(AppError.badRequest('articleLimit must be an integer between 1 and 200'));
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
      displayName: (req.body as SourceInput).displayName || name,
      baseUrl,
      adapter,
      ...(articleLimit ? { articleLimit } : {}),
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
    const allowedFields: (keyof SourceInput)[] = ['name', 'displayName', 'baseUrl', 'adapter', 'articleLimit', 'articleLinkSelector', 'contentSelector', 'titleSelector', 'imageSelector', 'isActive'];

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

  const adapter = req.body.adapter || 'generic';
  const selectors = {
    articleLinkSelector: req.body.articleLinkSelector || '',
    contentSelector: req.body.contentSelector || '',
    titleSelector: req.body.titleSelector || '',
    imageSelector: req.body.imageSelector || '',
  };

  const scraper = new PlaywrightScraper();
  try {
    // Fetch once for diagnostics, so a failure can say *why* rather than just
    // that it failed. Without this the only explanation lived in container
    // stdout, which the operator cannot see.
    let html = '';
    let fetchError: string | null = null;
    try {
      html = await scraper.renderHtml(url);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }

    const $ = html ? cheerio.load(html) : null;
    const bodyText = $ ? $('body').text().replace(/\s+/g, ' ').trim() : '';
    const count = (sel: string) => (sel && $ ? $(sel).length : null);

    // Interstitials return HTTP 200 with a page that is not the article, so a
    // status code alone cannot distinguish them.
    const head = bodyText.slice(0, 2000);
    const pageTitleText = $ ? $('title').text().trim() : '';
    const botChallenge =
      /bot check|just a moment|checking your browser|enable javascript and cookies|captcha|attention required/i.test(head);
    // Some sites answer an automated client with an error page rather than a
    // challenge, and it still arrives as a normal render.
    const accessBlocked =
      /^\s*(40[0-9]|50[0-9])|access denied|forbidden|not authori[sz]ed|request blocked/i.test(pageTitleText) ||
      /access denied|you (do not|don't) have permission|request blocked/i.test(head);

    const diagnostics = {
      pageTitle: $ ? $('title').text().trim().slice(0, 120) : null,
      renderedChars: html.length,
      visibleTextChars: bodyText.length,
      botChallengeDetected: botChallenge,
      accessBlocked,
      hasOgTitle: $ ? $('meta[property="og:title"]').length > 0 : false,
      hasOgImage: $ ? $('meta[property="og:image"]').length > 0 : false,
      paragraphCount: $ ? $('p').length : 0,
      selectorMatches: {
        articleLink: count(selectors.articleLinkSelector),
        content: count(selectors.contentSelector),
        title: count(selectors.titleSelector),
        image: count(selectors.imageSelector),
      },
      fetchError,
    };

    const article = fetchError
      ? null
      : await scraper.scrapeArticle(url, {
          name: req.body.name || 'Test Source',
          // The RSS adapter resolves items against the configured feed, so the
          // form's Base URL matters here — not just the URL under test.
          baseUrl: req.body.baseUrl || url,
          adapter,
          ...selectors,
          isActive: true,
          _id: {} as any,
        } as any);

    // Ordered most-specific first, so the operator gets the actionable cause
    // rather than a downstream symptom.
    const reason = (() => {
      if (article) return null;
      if (fetchError) return `The page could not be loaded: ${fetchError}`;
      // Reported before anything about selectors: no selector can match a page
      // the site refused to serve.
      if (accessBlocked)
        return `The site refused the request and returned "${diagnostics.pageTitle}" instead of the article. It is blocking automated access from this server, so no selector will help.`;
      if (botChallenge)
        return 'The site returned a bot-check page instead of the article. Automated scraping is being blocked, so no selector will match.';
      if (adapter === 'generic' && !selectors.contentSelector)
        return 'No "Main content body" selector was provided, and the generic adapter needs one to find the article text.';
      if (diagnostics.selectorMatches.content === 0)
        return `The content selector "${selectors.contentSelector}" matched no elements on this page. Check it against the page, or confirm this URL is an article rather than a listing page.`;
      if (diagnostics.paragraphCount === 0)
        return 'The rendered page contained no paragraphs, so it is probably a listing page, a redirect, or not fully loaded.';
      return 'The adapter could not extract an article from this page.';
    })();

    res.json({
      success: true,
      data: {
        ok: article !== null,
        reason,
        diagnostics,
        article: article
          ? {
              title: article.title,
              heroImage: article.heroImage,
              fullContent: article.fullContent,
              summary: article.summary,
              contentImages: article.contentImages,
              publishedAt: article.publishedAt,
              category: article.category,
            }
          : null,
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
 * GET /api/admin/sources/scrape-runs
 * Recent scrape runs, newest first. This is the only durable record of what the
 * pipeline did — previously it existed solely in container stdout, so a source
 * that quietly began returning zero links could go unnoticed indefinitely.
 */
router.get('/scrape-runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const { runs, totalRuns } = await new ScrapeRunRepository().findRecent(page, limit);

    res.json({
      success: true,
      data: {
        runs,
        totalRuns,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(totalRuns / limit)),
      },
      error: null,
    });
  } catch (error) {
    next(error);
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
