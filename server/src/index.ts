import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { SessionGuardian } from './services/SessionGuardian.js';
import { router as roomsRouter } from './routes/rooms.js';
import { router as agentsRouter } from './routes/agents.js';
import { router as messagesRouter } from './routes/messages.js';
import webhookRouter from './routes/webhooks.js';
import openclawGatewayRouter from './routes/openclaw-gateway.js';
import debugRouter from './routes/debug.js';
import { initializeIO } from './lib/socket.js';
import { setupWebSocket } from './websocket/index.js';
import { feishuOfficial } from './services/FeishuOfficialService.js';
import { handleFeishuMessage } from './services/MessageService.js';
import { OpenClawService } from './services/OpenClawService.js';
import { openClawService } from './services/OpenClawService.js';
import healthRemoteRouter from './routes/health-remote.js';
import path from 'path';
import logger from './config/logger.js';

// Load environment variables
const initEnv = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  config({ path: envPath });
};

initEnv();

// Initialize Prisma (singleton for production)
export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// Socket.io instance - use getIO() from lib/socket.ts instead of importing io directly

/**
 * Create Express app with all routes and middleware
 * Exported for testing - allows test isolation
 */
export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Rate limiting for API routes (applied after middleware, before routes)
  if (process.env.NODE_ENV !== 'test') {
    import('./middleware/rateLimiter.js')
      .then(({ apiLimiter }) => {
        app.use('/api/', apiLimiter);
        logger.info('Rate limiting enabled (100 req/15min)');
      })
      .catch((err) => logger.error('Failed to load rate limiter:', err));
  }

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const healthData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    // Add OpenClaw service status
    try {
      const openClawHealth = await openClawService.healthCheck();
      healthData.openclaw = openClawHealth;
    } catch (error: any) {
      healthData.openclaw = {
        status: 'error',
        error: error.message,
      };
    }

    res.json(healthData);
  });

  // Remote mode health endpoints
  app.use('/health', healthRemoteRouter);

  // API Routes (order matters - most specific first)
  app.use('/api/rooms', roomsRouter);
  app.use('/api/messages', messagesRouter); // Fixed: mount at /api/messages to avoid conflict
  app.use('/api/agents', agentsRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/openclaw', openclawGatewayRouter);

  // API Documentation (Swagger/OpenAPI)
  if (process.env.NODE_ENV !== 'production') {
    import('./routes/docs.js')
      .then(({ router: docsRouter }) => {
        app.use('/api/docs', docsRouter);
        logger.info('API Documentation: http://localhost:4000/api/docs');
      })
      .catch((err) => logger.error('Failed to load docs router:', err));
  }

  // Debug routes (testing only - not for production)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/debug', debugRouter);
    logger.info('Debug routes enabled (testing only)');
  }

  // Feishu webhook endpoint
  app.post('/api/webhooks/feishu', async (req, res) => {
    try {
      logger.info('[Webhook] Feishu event received:', req.body.type);
      // Note: handleFeishuMessage requires feishuChatId parameter
      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('[Webhook] Error processing Feishu message:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Frontend proxy (production only)
  if (process.env.NODE_ENV === 'production') {
    const clientPath = path.resolve(process.cwd(), 'client');
    logger.info(`[Server] Serving frontend from ${clientPath}`);
    app.use(express.static(clientPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  // Global error handler (must be last)
  import('./middleware/errorHandler.js')
    .then(({ errorHandler }) => {
      app.use(errorHandler);
    })
    .catch((err) => logger.error('Failed to load error handler:', err));

  return app;
}

/**
 * Start HTTP server with Socket.io
 * Separated from app creation for test flexibility
 */
export function startServer(
  app: express.Express,
  port: number = parseInt(process.env.PORT || '4000', 10)
): { httpServer: HttpServer; io: Server } {
  const httpServer = createServer(app);
  const socketIO = initializeIO(httpServer);

  // Setup WebSocket event handlers
  setupWebSocket(socketIO);

  httpServer.listen(port, () => {
    logger.info(`Backend running on http://localhost:${port}`);
    logger.info('WebSocket server ready');
  });

  return { httpServer, io: socketIO };
}

/**
 * Initialize background services
 * Separated for test control (can skip in tests)
 */
export async function initializeServices(): Promise<void> {
  // Start Session Guardian (it's already a singleton)
  SessionGuardian.start();
  logger.info('Session Guardian started (30s check interval)');

  // Start Feishu WebSocket (if configured)
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    logger.info('Feishu integration configured, connecting...');
    await feishuOfficial.start();
    logger.info('Feishu WebSocket started');
  } else {
    logger.warn('Feishu not configured (missing credentials)');
  }
}

// Production: Create app, start server, initialize services
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const { httpServer } = startServer(app);

  initializeServices().catch((err) => logger.error('Service initialization error:', err));

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}
