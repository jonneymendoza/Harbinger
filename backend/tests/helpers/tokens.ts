import jwt from 'jsonwebtoken';
import { AuthPayload } from '../../src/infrastructure/auth/jwtService';

/**
 * jwtService reads JWT_SECRET at import time, so tests must pin it before
 * importing anything that pulls that module in.
 */
export const TEST_JWT_SECRET = 'test-secret-for-route-tests';

export function signTestToken(payload: Partial<AuthPayload> = {}): string {
  const body: AuthPayload = {
    sub: payload.sub ?? '507f1f77bcf86cd799439011',
    email: payload.email ?? 'user@example.com',
    role: payload.role ?? 'USER',
  };
  return jwt.sign(body, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

export function bearer(payload: Partial<AuthPayload> = {}): string {
  return `Bearer ${signTestToken(payload)}`;
}

/** A structurally valid token signed with the wrong key. */
export function bearerWithBadSignature(): string {
  const token = jwt.sign({ sub: 'x', email: null, role: 'USER' }, 'not-the-right-secret', {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  return `Bearer ${token}`;
}

export function bearerExpired(): string {
  const token = jwt.sign({ sub: 'x', email: null, role: 'USER' }, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '-1s',
  });
  return `Bearer ${token}`;
}
