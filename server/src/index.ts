import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { SessionGuardian } from './services/SessionGuardian.js';
import { router as roomsRouter } from './routes/rooms.js';
import { router as agentsRouter } from './routes/agents.js';
import { router as messagesRouter } from './routes/messages.js';
import webhookRouter from './routes/webhooks.js';
import openclawGatewayRouter from './routes/openclaw-gateway.js';
import { initializeIO } from './lib/socket.js';
import { feishuOfficial } from './services/FeishuOfficialService.js';
import { handleFeishuMessage } from './services/MessageService.js';
import path from 'path';

// Load environment variables with Jest compatibility
// Jest runs in CommonJS context, production uses ES modules
const initEnv = () => {
  // In Jest, process.cwd() points to project root
  // In production (ESM), we need import.meta.url
  const envPath = path.resolve(process.cwd(), '.env');
  config({ path: envPath });
};

initEnv();

// Initialize Prisma
export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeIO(httpServer);
export { io };

// Middleware
app.use(cors());
app.use(express.json());

import { OpenClawService } from './services/OpenClawService';
import healthRemoteRouter from './routes/health-remote';

// Health check endpoint
app.get('/health', async (_req, res) => {
  const healthData: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  // Add OpenClaw service status (especially important for remote mode)
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

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
    },
  });
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('room:join', (data: { roomId: string }) => {
    socket.join(data.roomId);
    console.log(`✅ Client ${socket.id} joined room ${data.roomId}`);
  });

  socket.on('message:send', async (data: { roomId: string; content: string }) => {
    // Handle message sending (to be implemented)
    console.log('Message received:', data);
  });
});

// Start server
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(parseInt(PORT as string), HOST as string, async () => {
  console.log(`
╔════════════════════════════════════════════════╗
║           Agent Hub Server Started             ║
╠════════════════════════════════════════════════╣
║  HTTP:    http://${HOST}:${PORT}                    ║
║  Health:  http://${HOST}:${PORT}/health               ║
║  WebSocket: ws://${HOST}:${PORT}                     ║
╚════════════════════════════════════════════════╝
  `);

  // Start Session Guardian
  await SessionGuardian.start();
  console.log('✓ Session Guardian started');

  // Start Feishu WebSocket (if configured)
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    console.log('📱 Starting Feishu WebSocket (Official SDK)...');

    // Connect Feishu message handler to MessageService
    feishuOfficial.on('message', async (normalizedMessage, chatId) => {
      await handleFeishuMessage(
        normalizedMessage,
        chatId,
        feishuOfficial.sendToFeishu.bind(feishuOfficial)
      );
    });

    // Start WebSocket connection (SDK handles authentication)
    await feishuOfficial.start();
    console.log('✓ Feishu WebSocket started');
  } else {
    console.log('⚠️  Feishu not configured (missing credentials)');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, httpServer };
