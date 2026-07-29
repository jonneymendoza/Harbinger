import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { connectDB } from '@infrastructure/mongoose';
import authRoutes from '@domains/auth/routes/index';
import healthRouter from '@domains/health/route';
import adminSourcesRouter from '@domains/sources/routes/admin.route';
import newsRouter from '@domains/news/routes/news.route';
import { authMiddleware, checkRole } from '@infrastructure/middleware/authMiddleware';
import { errorHandler, notFoundHandler } from '@shared/errors/errorHandler';
import { initScraperCron } from '@cron/scraperCron';

const app = express();

export async function bootstrap() {
  await connectDB();

  // Initialize scraper cron job
  initScraperCron();

  app.use(helmet());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3300').split(',');
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  app.use('/api/', limiter);

  app.use(express.json({ limit: '10kb' }));
  app.use(mongoSanitize());

  app.use(compression());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRoutes);
  app.use('/api/news', newsRouter);
  // Admin source management is privileged: every route below requires a valid
  // JWT carrying the ADMIN role (PRD §4.B).
  app.use('/api/admin/sources', authMiddleware, checkRole(['ADMIN']), adminSourcesRouter);

  // Must stay last: unmatched routes, then the handler that renders every
  // failure as the standard { success, data, error } envelope.
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default app;
