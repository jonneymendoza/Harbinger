import { Router } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '@infrastructure/mongoose';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await connectDB();
    const dbState = mongoose.connection.readyState;
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: stateNames[dbState] || 'unknown',
      },
      error: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: {
        message: 'Health check failed',
        code: 'HEALTH_CHECK_FAILED',
      },
    });
  }
});

export default router;
