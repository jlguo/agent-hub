/**
 * Error Handler Middleware
 *
 * Standardized error handling for all API routes.
 * Ensures consistent error response format across the entire API.
 * Uses the unified AppError from error-handler.ts.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/error-handler.js';

// Re-export for backward compatibility
export { AppError as ApiError } from '../utils/error-handler.js';
export { ErrorCode } from '../utils/error-handler.js';
export type { AppErrorResponse as ApiErrorResponse } from '../utils/error-handler.js';

/**
 * Error Handler Middleware
 *
 * Catches all errors and formats them consistently using AppError.toResponse()
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Log error for debugging
  console.error('[ErrorHandler]', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Handle AppError instances (including former ApiError instances)
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toResponse(req.path));
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const apiError = AppError.internal('Database operation failed');
    res.status(500).json(apiError.toResponse(req.path));
    return;
  }

  // Handle validation errors from libraries like zod/joi
  if (err.name === 'ValidationError') {
    const apiError = AppError.validationError({ message: err.message });
    res.status(422).json(apiError.toResponse(req.path));
    return;
  }

  // Default: Internal server error
  const apiError = AppError.internal(
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
