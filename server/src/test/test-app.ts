/**
 * Test App Helper
 * Creates Express app for integration testing without import.meta issues
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { router as messagesRouter } from '../routes/messages.js';
import { router as roomsRouter } from '../routes/rooms.js';
import { initializeIO } from '../lib/socket.js';

export const prisma = new PrismaClient();
export const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Socket.IO
const io = initializeIO(httpServer);

// Routes
app.use('/api/messages/rooms', messagesRouter);
app.use('/api/rooms', roomsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export { io, httpServer };
