/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse and DoS attacks.
 * Configurable via environment variables.
 */

import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limit configuration
 *
 * Environment Variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 900000 = 15 min)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_TRUST_PROXY: Trust reverse proxies (default: true)
 */
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
const TRUST_PROXY = process.env.RATE_LIMIT_TRUST_PROXY !== 'false';

/**
 * General API rate limiter
 *
 * Applied to all /api/* routes
 * Default: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  trustProxy: TRUST_PROXY,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,

  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    },
  },

  // Custom key generator (use user ID if authenticated, otherwise IP)
  keyGenerator: (req: Request): string => {
    // Use user ID from auth if available
    const userId = (req as any).user?.id;
    if (userId) return `user:${userId}`;

    // Fall back to IP address
    return req.ip || 'unknown';
  },

  // Request handler when limit is exceeded
  handler: (req: Request, res: Response) => {
    console.warn('[RateLimiter] Limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
    });

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(WINDOW_MS / 1000),
        limit: MAX_REQUESTS,
        windowMs: WINDOW_MS,
      },
    });
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 *
 * Used for authentication, password reset, etc.
 * Default: 10 requests per 15 minutes per IP
 */
export const strictLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_STRICT_MAX || '10', 10),
  trustProxy: TRUST_PROXY,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts, please try again later',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    },
  },
});

/**
 * Lightweight rate limiter for read-only endpoints
 *
 * Used for GET requests that are cheap to process
 * Default: 200 requests per 15 minutes per IP
 */
export const readLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: parseInt(process.env.RATE_LIMIT_READ_MAX || '200', 10),
  trustProxy: TRUST_PROXY,
  skipSuccessfulRequests: true, // Only count failed requests
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please slow down',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    },
  },
});

/**
 * No rate limiting (for development/testing)
 */
export const noLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 999999,
  trustProxy: TRUST_PROXY,
  skip: () => true,
});
