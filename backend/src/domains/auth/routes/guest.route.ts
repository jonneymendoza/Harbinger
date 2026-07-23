import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { signGuestToken } from '@infrastructure/auth/jwtService';

const router = Router();

interface GuestUserBody {
  provider: 'guest';
  providerId: string;
  displayName: string;
  role: 'USER' | 'GUEST';
}

router.post('/', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('database not connected');

    // Step 1: Check for ANY existing guest user in MongoDB
    let guestUser: any = await db
      .collection('users')
      .findOne({ provider: 'guest' } as any);

    // Step 2: No guest user exists — create one
    if (!guestUser) {
      const newGuest: GuestUserBody = {
        provider: 'guest' as const,
        providerId: require('crypto').randomUUID(),
        displayName: 'Guest',
        role: 'USER' as const,
      };
      await db.collection('users').insertOne(newGuest);
    }

    // Issue JWT (either for existing or newly created guest)
    const token = signGuestToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    res.json({
      success: true,
      data: { token, expiresAt },
      error: null,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      data: null,
      error: { message: err.message || 'Failed to issue guest session', code: 'GUEST_ISSUE_ERROR' },
    });
  }
});

export default router;
