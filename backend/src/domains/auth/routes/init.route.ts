import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AppError } from '@shared/errors/appError';

const router = Router();

router.post('/:provider', (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider as 'google' | 'apple' | 'facebook';

  const allowedProviders = ['google', 'apple', 'facebook'];
  if (!allowedProviders.includes(provider)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { message: `Provider '${provider}' is not supported`, code: 'INVALID_PROVIDER' },
    });
  }

  passport.authorize(`${provider}-oauth2`, { session: false })(req, res, (err: Error | null) => {
    if (err) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { message: 'Failed to initiate OAuth flow', code: 'OAUTH_INIT_ERROR' },
      });
    }

    const authUrl = (req as any)._passport?.instance?._authInfo?.authorizationURL || '';

    if (!authUrl) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { message: 'Authorization URL not available', code: 'NO_AUTH_URL' },
      });
    }

    res.json({
      success: true,
      data: { authorizationUrl: authUrl },
      error: null,
    });
  });
});

export default router;
