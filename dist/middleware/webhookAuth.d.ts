import { Request, Response, NextFunction } from 'express';
/**
 * Verify OpenClaw webhook authentication token
 *
 * Expects header: x-openclaw-token
 * Compares with env: OPENCLAW_VERIFICATION_TOKEN
 */
export declare function verifyWebhookToken(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=webhookAuth.d.ts.map