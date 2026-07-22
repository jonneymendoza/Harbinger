import { Router } from 'express';
import passport from 'passport';
import { signJWT, AuthPayload } from '@infrastructure/auth/jwtService';
import { AppError } from '@shared/errors/appError';

const router = Router();

function createCallback(provider: string) {
  return (req: any, res: any, next: any) => {
    passport.authenticate(provider, { session: false }, (err: Error | null, user: any, info: any) => {
      if (err) {
        return res.status(500).json({
          success: false,
          data: null,
          error: { message: err.message, code: 'OAUTH_CALLBACK_ERROR' },
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          data: null,
          error: { message: info?.message || 'Authentication failed', code: 'AUTH_FAILED' },
        });
      }

      const payload: AuthPayload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      const token = signJWT(payload);

      res.json({
        success: true,
        data: { token },
        error: null,
      });
    })(req, res, next);
  };
}

router.get('/google/callback', createCallback('google'));
router.get('/apple/callback', createCallback('apple'));
router.get('/facebook/callback', createCallback('facebook'));

export default router;
