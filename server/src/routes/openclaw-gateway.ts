/**
 * OpenClaw Gateway API
 *
 * Allows remote clients to call OpenClaw agents via HTTP
 * Supports both token authentication and API key authentication
 */

import express from 'express';
import { verifyToken, verifyApiKey, AuthRequest } from '../middleware/auth';
import { openClawService, OpenClawSendResult } from '../services/OpenClawService';

const router = express.Router();

export interface GatewayRequest {
  message: string;
  agent: string;
  sessionId: string;
  context?: Record<string, any>;
  deliver?: boolean;
  replyAccount?: string;
  replyTo?: string;
}

export interface GatewayResponse {
  success: boolean;
  content: string;
  usage?: {
    totalTokens: number;
    cost: number;
  };
  metadata: {
    agent: string;
    sessionId: string;
    timestamp: string;
    duration: number;
  };
}

/**
 * POST /api/openclaw/gateway
 *
 * Call OpenClaw agent via HTTP Gateway
 *
 * Authentication:
 * - Bearer token: Authorization: Bearer <OPENCLAW_VERIFICATION_TOKEN>
 * - API key: X-API-Key: <API_KEY>
 *
 * Request:
 * {
 *   "message": "Hello!",
 *   "agent": "family-mom",
 *   "sessionId": "family-chat-mom",
 *   "context": { ... },  // Optional
 *   "deliver": false,    // Optional
 *   "replyAccount": "family",  // Optional
 *   "replyTo": "oc_xxx"        // Optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "content": "Hey! How's it going?",
 *   "usage": {
 *     "totalTokens": 150,
 *     "cost": 0.002
 *   },
 *   "metadata": {
 *     "agent": "family-mom",
 *     "sessionId": "family-chat-mom",
 *     "timestamp": "2026-04-02T12:30:00Z",
 *     "duration": 11234
 *   }
 * }
 */
router.post(
  '/gateway',
  // Support both token and API key authentication
  (req: AuthRequest, res, next) => {
    // Try token auth first, then API key auth
    if (req.headers.authorization) {
      return verifyToken(req, res, next);
    } else if (req.headers['x-api-key']) {
      return verifyApiKey(req, res, next);
    } else {
      return res.status(401).json({
        error: 'Missing authentication',
        hint: 'Use Authorization: Bearer <token> or X-API-Key: <key>',
      });
    }
  },

  async (req: AuthRequest, res) => {
    const startTime = Date.now();

    try {
      const {
        message,
        agent,
        sessionId,
        context,
        deliver = false,
        replyAccount,
        replyTo,
      } = req.body as GatewayRequest;

      // Validate required fields
      if (!message || !agent || !sessionId) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['message', 'agent', 'sessionId'],
          hint: 'Provide message, agent, and sessionId in request body',
        });
      }

      console.log(`[OpenClaw Gateway] Request from authenticated client`);
      console.log(`  Agent: ${agent}`);
      console.log(`  Session: ${sessionId}`);
      console.log(`  Message length: ${message.length} chars`);

      // Call OpenClaw service
      const result: OpenClawSendResult = await openClawService.sendMessage(
        message,
        agent,
        sessionId
      );

      const duration = Date.now() - startTime;

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to process request',
          message: result.error || 'Unknown error',
          duration,
        });
      }

      // Return response
      const responseResult: GatewayResponse = {
        success: true,
        content: result.response || '',
        usage: undefined,
        metadata: {
          agent,
          sessionId,
          timestamp: new Date().toISOString(),
          duration,
        },
      };

      console.log(`[OpenClaw Gateway] ✅ Success in ${duration}ms`);
      res.json(responseResult);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[OpenClaw Gateway] ❌ Error after ${duration}ms:`, error.message);

      res.status(500).json({
        error: 'Failed to process request',
        message: error.message,
        duration,
      });
    }
  }
);

/**
 * GET /api/openclaw/gateway/health
 *
 * Health check endpoint (no auth required)
 */
router.get('/gateway/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.OPENCLAW_MODE || 'cli',
    timestamp: new Date().toISOString(),
  });
});

export default router;
