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
import { feishuOfficial } from './services/FeishuOfficialService.js';
import { handleFeishuMessage } from './services/MessageService.js';
import { OpenClawService } from './services/OpenClawService.js';
import healthRemoteRouter from './routes/health-remote.js';
import path from 'path';

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

// Socket.io instance (set by initializeIO)
let io: Server;
export { io };

/**
 * Create Express app with all routes and middleware
 * Exported for testing - allows test isolation
 */
export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const healthData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    // Add OpenClaw service status
    try {
      const openClawHealth = await OpenClawService.healthCheck();
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

  // API Routes
  app.use('/api/rooms', roomsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/openclaw', openclawGatewayRouter);

  // Debug routes (testing only - not for production)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/debug', debugRouter);
    console.log('🔧 Debug routes enabled (testing only)');
  }

  // Feishu webhook endpoint
  app.post('/api/webhooks/feishu', async (req, res) => {
    try {
      console.log('[Webhook] Feishu event received:', req.body.type);
      // Note: handleFeishuMessage requires feishuChatId parameter
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[Webhook] Error processing Feishu message:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Frontend proxy (production only)
  if (process.env.NODE_ENV === 'production') {
    const clientPath = path.resolve(process.cwd(), 'client');
    console.log(`[Server] Serving frontend from ${clientPath}`);
    app.use(express.static(clientPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

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
  io = socketIO;

  httpServer.listen(port, () => {
    console.log(`🚀 Backend running on http://localhost:${port}`);
    console.log(`📡 WebSocket server ready`);
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
  console.log('✓ Session Guardian started (30s check interval)');

  // Start Feishu WebSocket (if configured)
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    console.log('📬 Feishu integration configured, connecting...');
    await feishuOfficial.start();
    console.log('✓ Feishu WebSocket started');
  } else {
    console.log('⚠️  Feishu not configured (missing credentials)');
  }
}

// Production: Create app, start server, initialize services
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const { httpServer } = startServer(app);

  initializeServices().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
