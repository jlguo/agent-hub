import { Router, Request, Response } from 'express';
import { OpenClawService } from '../services/OpenClawService';

const router = Router();

/**
 * GET /health/remote
 *
 * Detailed health check for remote mode deployments
 * Includes SSH tunnel status, OpenClaw Gateway connectivity, and metrics
 */
router.get('/remote', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Run OpenClaw health check
    const openClawHealth = await OpenClawService.healthCheck();

    const healthDuration = Date.now() - startTime;

    // Build comprehensive health response
    const healthData = {
      status: openClawHealth.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        openclaw: openClawHealth,
        health_check_duration_ms: healthDuration,
      },
      remote_mode: {
        enabled: process.env.OPENCLAW_MODE === 'remote',
        gateway_url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
        ssh_host: process.env.SSH_HOST || 'unknown',
        ssh_user: process.env.SSH_USER || 'unknown',
      },
      metrics: {
        prometheus: '/metrics',
        prometheus_remote_mode: '/metrics/remote-mode',
      },
    };

    // Return appropriate status code
    if (openClawHealth.status === 'healthy') {
      res.status(200).json(healthData);
    } else {
      res.status(503).json({
        ...healthData,
        status: 'unhealthy',
        error: openClawHealth.error || 'Health check failed',
      });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error('[Health Remote] Error:', error.message);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        health_check_duration_ms: duration,
      },
      error: error.message,
      remote_mode: {
        enabled: process.env.OPENCLAW_MODE === 'remote',
      },
    });
  }
});

/**
 * GET /remote/quick
 *
 * Quick health check (no external calls)
 * Returns immediately with last known status
 */
router.get('/remote/quick', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    remote_mode: {
      enabled: process.env.OPENCLAW_MODE === 'remote',
    },
  });
});

export default router;
