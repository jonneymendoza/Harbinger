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

const app = express();

export async function bootstrap() {
  await connectDB();

  app.use(helmet());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
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

  return app;
}

export default app;
