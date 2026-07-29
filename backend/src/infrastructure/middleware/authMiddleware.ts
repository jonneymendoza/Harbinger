import { verifyToken, AuthPayload } from '@infrastructure/auth/jwtService';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/appError';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication token is required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the signature only — deciding which roles a route accepts is
    // checkRole's job. Verifying as a guest token here would reject every
    // USER and ADMIN token outright.
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function checkRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) {
      return next(AppError.unauthorized('Authentication token is required'));
    }

    // GUEST role is allowed only on routes that explicitly permit it
    if (user.role === 'GUEST' && !roles.includes('GUEST')) {
      return next(AppError.forbidden(
        user.email
          ? 'Insufficient permissions'
          : 'Guests cannot access this resource. Please create an account to save articles.'
      ));
    }

    if (!roles.includes(user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Optional auth guard that also accepts GUEST role on allow-listed paths.
 * Used for public-but-preferred-auth endpoints (e.g. /api/news).
 */
export function optionalAuth(allowGuestOn?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token — treat as public endpoint
      (req as any).user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      (req as any).user = decoded;
      if (decoded.role === 'GUEST' && allowGuestOn && !allowGuestOn.includes(req.path)) {
        return next(AppError.forbidden(
          decoded.email
            ? 'Insufficient permissions'
            : 'Guests cannot access this resource. Please create an account to save articles.'
        ));
      }
      next();
    } catch {
      // Invalid token — clear it and treat as public
      (req as any).user = null;
      next();
    }
  };
}
