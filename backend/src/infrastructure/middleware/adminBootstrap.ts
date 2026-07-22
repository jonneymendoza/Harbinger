import { User } from '@domains/auth/models/User';
import bcrypt from 'bcryptjs';

export async function adminBootstrap(): Promise<void> {
  const adminEmail = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!adminEmail || !adminPass) {
    console.log('[Admin Bootstrap] ADMIN_USER or ADMIN_PASS not set. Skipping.');
    return;
  }

  try {
    const existingAdmin = await User.findOne({ role: 'ADMIN', provider: 'local' });

    if (existingAdmin) {
      console.log('[Admin Bootstrap] Admin user already exists. Skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash(adminPass, 12);

    await User.create({
      email: adminEmail,
      displayName: 'Admin',
      provider: 'local',
      providerId: `local-${Date.now()}`,
      role: 'ADMIN',
      passwordHash,
    });

    console.log('[Admin Bootstrap] Admin user seeded successfully.');
  } catch (error) {
    console.error('[Admin Bootstrap] Failed to seed admin user:', error);
  }
}
