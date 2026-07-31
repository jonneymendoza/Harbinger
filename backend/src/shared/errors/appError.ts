export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 'NOT_FOUND', 404);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 'FORBIDDEN', 403);
  }

  static badRequest(message = 'Bad request'): AppError {
    return new AppError(message, 'BAD_REQUEST', 400);
  }

  /** The request is valid but conflicts with current state — e.g. a scrape already running. */
  static conflict(message = 'Conflict'): AppError {
    return new AppError(message, 'CONFLICT', 409);
  }

  static internalServerError(message = 'Internal server error'): AppError {
    return new AppError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
