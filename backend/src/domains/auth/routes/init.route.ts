import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * POST /:provider — Initiates OAuth flow by returning the authorization URL.
 * The frontend opens a popup and navigates it to this URL.
 */
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

  let authUrl: string | null = null;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
    if (!clientId) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { message: 'Google OAuth not configured', code: 'NOT_CONFIGURED' },
      });
    }
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid profile email',
      access_type: 'offline',
      prompt: 'consent',
    }).toString()}`;
  } else if (provider === 'facebook') {
    const appId = process.env.FACEBOOK_APP_ID;
    const callbackUrl = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback';
    if (!appId) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { message: 'Facebook OAuth not configured', code: 'NOT_CONFIGURED' },
      });
    }
    authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${new URLSearchParams({
      client_id: appId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'public_profile,email',
    }).toString()}`;
  } else if (provider === 'apple') {
    const clientId = process.env.APPLE_CLIENT_ID;
    const callbackUrl = process.env.APPLE_CALLBACK_URL || 'http://localhost:5000/api/auth/apple/callback';
    if (!clientId) {
      return res.status(500).json({
        success: false,
        data: null,
        error: { message: 'Apple OAuth not configured', code: 'NOT_CONFIGURED' },
      });
    }
    authUrl = `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      nonce: require('crypto').randomUUID(),
    }).toString()}`;
  }

  if (!authUrl) {
    return res.status(500).json({
      success: false,
      data: null,
      error: { message: 'Failed to generate authorization URL', code: 'NO_AUTH_URL' },
    });
  }

  res.json({
    success: true,
    data: { authorizationUrl: authUrl },
    error: null,
  });
});

export default router;
