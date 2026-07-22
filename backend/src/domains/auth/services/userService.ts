import type { Profile } from 'passport';
import { User, IUser } from '@domains/auth/models/User';

export interface OAuthProfile extends Omit<Profile, 'emails'> {
  emails?: Array<{ value: string }>;
  displayName?: string;
}

function getProviderName(profile: OAuthProfile): 'google' | 'apple' | 'facebook' | 'local' {
  const raw = profile._json??.provider || profile.provider || '';
  return (raw === 'google' || raw === 'apple' || raw === 'facebook' ? raw : 'local') as 'google' | 'apple' | 'facebook' | 'local';
}

export async function findOrCreateUser(profile: OAuthProfile): Promise<IUser> {
  const provider = getProviderName(profile);
  const email = profile.emails?.[0]?.value || '';
  const displayName = profile.displayName || profile.emails?.[0]?.value || profile.id;
  const providerId = profile.id;

  let user = await User.findOne({ provider, providerId }).select('+passwordHash').lean();

  if (user) {
    return user as unknown as IUser;
  }

  const newUser = await User.create({
    email,
    displayName,
    provider,
    providerId,
    role: 'USER',
  });

  return newUser as unknown as IUser;
}
