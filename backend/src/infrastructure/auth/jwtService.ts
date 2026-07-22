import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d';

import jwt, { SignOptions } from 'jsonwebtoken';

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
}

export function signJWT(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET as any, { algorithm: 'HS256', expiresIn: JWT_EXPIRY as any });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthPayload;
}
