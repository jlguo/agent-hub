import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  authenticated?: boolean;
  token?: string;
}

/**
 * Verify OpenClaw verification token
 * 
 * Usage:
 * ```typescript
 * router.post('/gateway', verifyToken, handler);
 * ```
 */
export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Missing Authorization header',
      hint: 'Use: Authorization: Bearer <token>'
    });
  }

  // Support: "Bearer <token>" or just "<token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  const expectedToken = process.env.OPENCLAW_VERIFICATION_TOKEN;

  if (!expectedToken) {
    console.error('[Auth] OPENCLAW_VERIFICATION_TOKEN not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      hint: 'Set OPENCLAW_VERIFICATION_TOKEN environment variable'
    });
  }

  if (token !== expectedToken) {
    console.warn(`[Auth] Invalid token attempt from ${req.ip}`);
    return res.status(403).json({
      error: 'Invalid authentication token'
    });
  }

  // Token valid, proceed
  req.authenticated = true;
  req.token = token;
  next();
}

/**
 * Optional authentication (doesn't block if missing)
 * Useful for endpoints that work better with auth but don't require it
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const expectedToken = process.env.OPENCLAW_VERIFICATION_TOKEN;
    
    if (token === expectedToken) {
      req.authenticated = true;
      req.token = token;
    }
  }

  next();
}

/**
 * Verify API key (alternative authentication method)
 */
export function verifyApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing X-API-Key header'
    });
  }

  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    console.error('[Auth] API_KEY not configured');
    return res.status(500).json({
      error: 'Server configuration error'
    });
  }

  if (apiKey !== expectedApiKey) {
    console.warn(`[Auth] Invalid API key attempt from ${req.ip}`);
    return res.status(403).json({
      error: 'Invalid API key'
    });
  }

  req.authenticated = true;
  req.token = apiKey;
  next();
}
