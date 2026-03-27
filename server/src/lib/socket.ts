import { Server } from 'socket.io';

let io: Server;

/**
 * Initialize Socket.io instance
 */
export function initializeIO(server: any): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });
  
  return io;
}

/**
 * Get Socket.io instance
 * Must call initializeIO() first
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeIO() first.');
  }
  return io;
}
