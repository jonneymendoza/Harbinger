import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d';

import jwt, { SignOptions } from 'jsonwebtoken';

export interface AuthPayload {
  sub: string;
  email: string | null;
  role: 'USER' | 'ADMIN' | 'GUEST';
}

export function signGuestToken(): string {
  const GUEST_EXPIRY = process.env.JWT_EXPIRY_GUEST || '7d';
  const payload: AuthPayload = {
    sub: require('crypto').randomUUID(),
    email: null,
    role: 'GUEST',
  };
  return jwt.sign(payload, JWT_SECRET as any, { algorithm: 'HS256', expiresIn: GUEST_EXPIRY as any });
}

export function signJWT(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET as any, { algorithm: 'HS256', expiresIn: JWT_EXPIRY as any });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
}

/** Verify a guest token — same algorithm but role must be GUEST */
export function verifyGuestJWT(token: string): AuthPayload {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
  if (payload.role !== 'GUEST') {
    throw new Error('Not a guest token');
  }
  return payload;
}
