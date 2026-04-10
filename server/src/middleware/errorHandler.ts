/**
 * Error Handler Middleware
 *
 * Standardized error handling for all API routes.
 * Ensures consistent error response format across the entire API.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * API Error Code Enum
 *
 * Standardized error codes for programmatic handling
 */
export enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * API Error Response Structure
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

/**
 * Custom API Error Class
 */
export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    status: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to API response format
   */
  toResponse(path: string, requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
        path,
        requestId,
      },
    };
  }

  /**
   * Create 400 Bad Request error
   */
  static badRequest(message: string, details?: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.BAD_REQUEST, message, 400, details);
  }

  /**
   * Create 401 Unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  /**
   * Create 403 Forbidden error
   */
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(ErrorCode.FORBIDDEN, message, 403);
  }

  /**
   * Create 404 Not Found error
   */
  static notFound(resource: string = 'Resource'): ApiError {
    return new ApiError(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }

  /**
   * Create 409 Conflict error
   */
  static conflict(message: string): ApiError {
    return new ApiError(ErrorCode.CONFLICT, message, 409);
  }

  /**
   * Create 422 Validation Error
   */
  static validationError(details: Record<string, any>): ApiError {
    return new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', 422, details);
  }

  /**
   * Create 500 Internal Error
   */
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }

  /**
   * Create 503 Service Unavailable
   */
  static unavailable(message: string = 'Service unavailable'): ApiError {
    return new ApiError(ErrorCode.SERVICE_UNAVAILABLE, message, 503);
  }
}

/**
 * Error Handler Middleware
 *
 * Catches all errors and formats them consistently
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Log error for debugging
  console.error('[ErrorHandler]', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toResponse(req.path));
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const apiError = ApiError.internal('Database operation failed');
    res.status(500).json(apiError.toResponse(req.path));
    return;
  }

  // Handle validation errors from libraries like zod/joi
  if (err.name === 'ValidationError') {
    const apiError = ApiError.validationError({ message: err.message });
    res.status(422).json(apiError.toResponse(req.path));
    return;
  }

  // Default: Internal server error
  const apiError = ApiError.internal(
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  );
  res.status(500).json(apiError.toResponse(req.path));
}

/**
 * Async Handler Wrapper
 *
 * Wraps async route handlers to catch promise rejections
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
