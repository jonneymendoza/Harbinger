import { Router, Request, Response } from 'express';
import passport from 'passport';
import { signJWT, AuthPayload } from '@infrastructure/auth/jwtService';

const router = Router();

function createCallbackHandler(provider: string) {
  return (req: Request, res: Response, next: Function) => {
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

      // Build the user object to send back to the frontend
      const frontendUser = {
        id: user._id.toString(),
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email,
        picture: user.picture || null,
      };

      // OAuth callbacks always come from browser redirects (no custom headers possible).
      // Redirect directly to frontend with token in URL — standard OAuth pattern.
      const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3300'}?oauth_token=${encodeURIComponent(token)}&oauth_user=${encodeURIComponent(JSON.stringify(frontendUser))}`;
      res.redirect(frontendUrl);
    })(req, res, next);
  };
}

// Export individual handlers for use in index.ts
export const googleCallbackHandler = createCallbackHandler('google');
export const appleCallbackHandler = createCallbackHandler('apple');
export const facebookCallbackHandler = createCallbackHandler('facebook');

// Also register on the router for direct export
router.get('/google/callback', googleCallbackHandler);
router.get('/apple/callback', appleCallbackHandler);
router.get('/facebook/callback', facebookCallbackHandler);

export default router;
