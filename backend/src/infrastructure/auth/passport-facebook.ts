import passport from 'passport';
import { Strategy as FacebookStrategy, Profile } from 'passport-facebook';
import { findOrCreateUser, OAuthProfile } from '@domains/auth/services/userService';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback';

export function configureFacebookStrategy(): void {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    console.warn('[Passport] FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not set. Facebook OAuth will not be available.');
    return;
  }

  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'emails', 'name'],
      },
      async (accessToken: string, refreshToken: string, profile: Profile, done: Function) => {
        try {
          const oAuthProfile: OAuthProfile = {
            id: profile.id,
            emails: profile.emails?.map((e) => ({ value: e.value })) || [{ value: '' }],
            displayName: [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(' ') || profile.displayName || 'Facebook User',
            _json: profile._json as any,
            provider: 'facebook',
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
