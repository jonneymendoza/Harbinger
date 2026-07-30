/**
 * Contract tests for POST /api/auth/login.
 *
 * This is the route that makes the admin API reachable at all, so the
 * assertions focus on the security-relevant behaviour: that failures are
 * indistinguishable, that OAuth accounts cannot be logged into with a password,
 * and that the issued token carries the right role.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { TEST_JWT_SECRET } from '../helpers/tokens';

process.env.JWT_SECRET = TEST_JWT_SECRET;

const userModel = { findOne: vi.fn() };
const bcryptMock = { compare: vi.fn(), hash: vi.fn() };

vi.mock('@domains/auth/models/User', () => ({ User: userModel }));
vi.mock('bcryptjs', () => ({ default: bcryptMock, ...bcryptMock }));

const { default: loginRoute, loginRateLimitStore } = await import(
  '../../src/domains/auth/routes/login.route'
);
const { errorHandler } = await import('../../src/shared/errors/errorHandler');

const ADMIN_ID = '507f1f77bcf86cd799439011';

/** Mirrors the `.select('+passwordHash')` chain the route uses. */
function selectChain(user: unknown) {
  return { select: vi.fn(async () => user) };
}

const adminUser = {
  _id: ADMIN_ID,
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMIN',
  provider: 'local',
  passwordHash: '$2a$12$fakehashvalue',
};

let app: Express;

beforeEach(async () => {
  vi.clearAllMocks();
  // The limiter is module-level, so its budget would otherwise leak between
  // cases and later tests would see 429 instead of the status under test.
  await loginRateLimitStore.resetAll?.();
  userModel.findOne.mockReturnValue(selectChain(adminUser));
  bcryptMock.compare.mockResolvedValue(true);

  app = express();
  app.use(express.json());
  app.use('/api/auth/login', loginRoute);
  app.use(errorHandler);
});

describe('POST /api/auth/login — success', () => {
  it('issues a token carrying the account role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const decoded = jwt.verify(res.body.data.token, TEST_JWT_SECRET) as any;
    expect(decoded).toMatchObject({ sub: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' });
  });

  it('returns the account summary without the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123!' });

    expect(res.body.data.user).toEqual({
      id: ADMIN_ID,
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(adminUser.passwordHash);
  });

  it('only considers credential accounts, never OAuth ones', async () => {
    await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'x' });

    // An OAuth account has no passwordHash; matching one by email would produce
    // confusing failures.
    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'admin@example.com',
      provider: 'local',
    });
  });

  it('normalises the email before lookup', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: '  ADMIN@Example.COM  ', password: 'x' });

    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'admin@example.com',
      provider: 'local',
    });
  });

  it('asks for the hash explicitly, since the schema hides it', async () => {
    const chain = selectChain(adminUser);
    userModel.findOne.mockReturnValue(chain);

    await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: 'x' });
    expect(chain.select).toHaveBeenCalledWith('+passwordHash');
  });
});

describe('POST /api/auth/login — failure', () => {
  it('returns 401 for a wrong password', async () => {
    bcryptMock.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an unknown account', async () => {
    userModel.findOne.mockReturnValue(selectChain(null));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
  });

  // Distinguishing these would confirm which emails have accounts.
  it('is indistinguishable between unknown account and wrong password', async () => {
    userModel.findOne.mockReturnValue(selectChain(null));
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' });

    userModel.findOne.mockReturnValue(selectChain(adminUser));
    bcryptMock.compare.mockResolvedValue(false);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'x' });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.error).toEqual(wrongPassword.body.error);
  });

  it('returns 401 when the account has no password set', async () => {
    userModel.findOne.mockReturnValue(selectChain({ ...adminUser, passwordHash: undefined }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'x' });

    expect(res.status).toBe(401);
    // Never compare against an absent hash.
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });

  it.each([
    ['missing password', { email: 'a@b.c' }],
    ['missing email', { password: 'x' }],
    ['empty body', {}],
    ['blank email', { email: '   ', password: 'x' }],
    ['non-string email', { email: 123, password: 'x' }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).post('/api/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('surfaces a database fault as 500 in the standard envelope', async () => {
    userModel.findOne.mockImplementation(() => {
      throw new Error('mongo is down');
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.c', password: 'x' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('POST /api/auth/login — rate limiting', () => {
  it('starts refusing attempts once the budget is spent', async () => {
    bcryptMock.compare.mockResolvedValue(false);

    let sawLimit = false;
    // Budget is 10 per window; a few extra proves the limiter engages.
    for (let i = 0; i < 14; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'guess' });
      if (res.status === 429) {
        expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
        sawLimit = true;
        break;
      }
    }

    expect(sawLimit).toBe(true);
  });
});
