import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { findOrCreateUser, OAuthProfile } from '@domains/auth/services/userService';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

export function configureGoogleStrategy(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('[Passport] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Google OAuth will not be available.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['openid', 'profile', 'email'],
      },
      async (accessToken: string, refreshToken: string, profile: Profile, done: Function) => {
        try {
          const oAuthProfile: OAuthProfile = {
            ...profile,
            _json: profile._json as any,
            provider: 'google',
            emails: profile.emails?.map((e) => ({ value: e.value })) || [{ value: profile.emails?.[0]?.value || '' }],
          };

          const user = await findOrCreateUser(oAuthProfile);
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}
