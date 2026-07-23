import express from 'express';
import { bootstrap } from './app';
import { connectDB, disconnectDB } from '@infrastructure/mongoose';
import { adminBootstrap } from '@infrastructure/middleware/adminBootstrap';
import { configureGoogleStrategy } from '@infrastructure/auth/passport-google';
import { configureAppleStrategy } from '@infrastructure/auth/passport-apple';
import { configureFacebookStrategy } from '@infrastructure/auth/passport-facebook';

const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '5000', 10);

async function startServer(): Promise<express.Application> {
  await connectDB();

  configureGoogleStrategy();
  configureAppleStrategy();
  configureFacebookStrategy();

  await adminBootstrap();

  const app = await bootstrap();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Listening on port ${PORT}`);
  });

  process.on('SIGINT', async () => {
    console.log('[Server] Shutting down...');
    await disconnectDB();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[Server] Shutting down...');
    await disconnectDB();
    process.exit(0);
  });

  return app;
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
