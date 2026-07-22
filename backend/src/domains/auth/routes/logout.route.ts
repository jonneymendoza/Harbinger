import { Router } from 'express';
import { authMiddleware } from '@infrastructure/middleware/authMiddleware';

const router = Router();

router.post('/', authMiddleware, (_req, res) => {
  res.json({
    success: true,
    data: null,
    error: null,
  });
});

export default router;
