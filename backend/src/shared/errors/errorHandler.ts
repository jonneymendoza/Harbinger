import { Request, Response, NextFunction } from 'express';
import { AppError } from './appError';

/**
 * Terminal 404 for unmatched /api routes, so a typo returns the standard
 * envelope rather than Express's HTML page.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/**
 * Global error handler. Every failure leaves the API as
 * `{ success, data, error: { code, message } }` — the contract the frontend
 * relies on, including its checks against specific error codes.
 *
 * Must be registered last: Express identifies error middleware by arity, so
 * all four parameters are required even though `next` is unused.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      data: null,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Mongoose duplicate key — surfaced as a client error, not a server fault.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      success: false,
      data: null,
      error: { code: 'DUPLICATE_KEY', message: 'A record with that unique value already exists' },
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  console.error('[ErrorHandler] Unhandled error:', err);

  res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      // Never leak internals to clients in production.
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
    },
  });
}
