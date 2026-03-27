import { Request, Response, NextFunction } from 'express';

/**
 * Verify OpenClaw webhook authentication token
 * 
 * Expects header: x-openclaw-token
 * Compares with env: OPENCLAW_VERIFICATION_TOKEN
 */
export function verifyWebhookToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-openclaw-token'] as string;
  const expectedToken = process.env.OPENCLAW_VERIFICATION_TOKEN;
  
  // Check if token is provided
  if (!token) {
    console.warn('[Webhook Auth] Missing authentication token');
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'MISSING_WEBHOOK_TOKEN',
      message: 'Missing x-openclaw-token header'
    });
  }
  
  // Check if expected token is configured
  if (!expectedToken) {
    console.warn('[Webhook Auth] OPENCLAW_VERIFICATION_TOKEN not configured');
    return res.status(500).json({ 
      error: 'Server Configuration Error',
      code: 'WEBHOOK_TOKEN_NOT_CONFIGURED',
      message: 'Server administrator must set OPENCLAW_VERIFICATION_TOKEN'
    });
  }
  
  // Validate token
  if (token !== expectedToken) {
    console.warn(`[Webhook Auth] Invalid token received (expected length: ${expectedToken.length}, got: ${token.length})`);
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'INVALID_WEBHOOK_TOKEN',
      message: 'Token mismatch'
    });
  }
  
  console.log('[Webhook Auth] ✅ Token verified successfully');
  next();
}
