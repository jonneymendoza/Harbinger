import passport from 'passport';
import { Strategy as AppleStrategy, Profile } from 'passport-apple';
import { findOrCreateUser, OAuthProfile } from '@domains/auth/services/userService';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
const APPLE_PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH || '';
const APPLE_CALLBACK_URL = process.env.APPLE_CALLBACK_URL || 'http://localhost:5000/api/auth/apple/callback';

export function configureAppleStrategy(): void {
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY_PATH) {
    console.warn('[Passport] Apple OAuth credentials incomplete. Apple sign-in will not be available.');
    return;
  }

  const fs = require('fs');
  const privateKeyContent = fs.readFileSync(APPLE_PRIVATE_KEY_PATH, 'utf8');

  passport.use(
    new AppleStrategy(
      {
        clientID: APPLE_CLIENT_ID,
        teamID: APPLE_TEAM_ID,
        keyID: APPLE_KEY_ID,
        privateKeyLocation: privateKeyContent,
        callbackURL: APPLE_CALLBACK_URL,
        passReqToCallback: false as any,
      },
      async (accessToken: string, refreshToken: string, idToken: string, profile: Profile, done: Function) => {
        try {
          const userString = idToken?.split('.')[1] || '';
          const decodedBuffer = Buffer.from(userString, 'base64');
          const decodedObj = JSON.parse(decodedBuffer.toString('utf8'));

          const oAuthProfile: OAuthProfile = {
            id: decodedObj?.sub || profile.id || '',
            displayName: decodedObj?.name || profile.displayName || 'Apple User',
            emails: [{ value: decodedObj?.email || '' }],
            _json: decodedObj,
            provider: 'apple',
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
