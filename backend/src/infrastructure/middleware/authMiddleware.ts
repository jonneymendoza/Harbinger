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

    if (!roles.includes(user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }

    next();
  };
}
