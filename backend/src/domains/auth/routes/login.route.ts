import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { User } from '@domains/auth/models/User';
import { signJWT } from '@infrastructure/auth/jwtService';
import { AppError } from '@shared/errors/appError';

const router = Router();

/** Exported so tests can clear counters between cases. */
export const loginRateLimitStore = new MemoryStore();

/**
 * Credential login is the one endpoint where guessing is the attack, so it gets
 * a tighter budget than the global API limiter.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: loginRateLimitStore,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again later.' },
    });
  },
});

/**
 * POST /api/auth/login
 *
 * Password login for accounts seeded with credentials — currently the bootstrap
 * admin (`ADMIN_USER`/`ADMIN_PASS`). Without this there is no way to obtain an
 * ADMIN token through the app, so the admin API is unreachable without minting
 * a JWT by hand.
 *
 * Scoped to `provider: 'local'`: OAuth accounts have no passwordHash, and
 * letting an email match one would invite confusing failures.
 */
router.post('/', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return next(AppError.badRequest('Email and password are required'));
    }

    // passwordHash is `select: false` on the schema, so ask for it explicitly.
    const user = await User.findOne({ email, provider: 'local' }).select('+passwordHash');

    // Same message and status whether the account is unknown or the password is
    // wrong — distinguishing them would confirm which emails exist.
    const invalid = () => next(AppError.unauthorized('Invalid email or password'));

    if (!user || !user.passwordHash) return invalid();

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return invalid();

    const token = signJWT({
      sub: String(user._id),
      email: user.email ?? null,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: String(user._id),
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
