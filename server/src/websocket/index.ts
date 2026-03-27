import { Server, Socket } from 'socket.io';
import { prisma } from '../index.js';

export interface WebSocketEvent<T = any> {
  event: string;
  data: T;
}

/**
 * Setup WebSocket handlers for Socket.io
 */
export function setupWebSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join a room
    socket.on('room:join', async (data: { roomId: string }, callback?: Function) => {
      try {
        const { roomId } = data;

        // Verify room exists
        const room = await prisma.room.findUnique({
          where: { id: roomId }
        });

        if (!room) {
          if (callback) callback({ error: 'Room not found' });
          return;
        }

        socket.join(roomId);
        console.log(`[WebSocket] Client ${socket.id} joined room ${roomId}`);

        // Get current room state
        const roomData = await prisma.room.findUnique({
          where: { id: roomId },
          include: {
            agents: { where: { isActive: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 50
            },
            discussions: {
              where: { status: 'active' }
            }
          }
        });

        if (callback) callback({ success: true, room: roomData });
      } catch (error: any) {
        console.error('[WebSocket] Error joining room:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // Send a message
    socket.on('message:send', async (data: { roomId: string; content: string; agentId?: string }, callback?: Function) => {
      try {
        const { roomId, content, agentId } = data;

        if (!content) {
          if (callback) callback({ error: 'Message content is required' });
          return;
        }

        // Save message to database
        const message = await prisma.message.create({
          data: {
            roomId,
            agentId: agentId || null,
            role: agentId ? 'assistant' : 'user',
            content
          },
          include: {
            agent: true
          }
        });

        // Broadcast to room
        io.to(roomId).emit('message:new', { message });

        console.log(`[WebSocket] Message saved in room ${roomId}: ${message.id}`);

        if (callback) callback({ success: true, message });
      } catch (error: any) {
        console.error('[WebSocket] Error sending message:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // Start a discussion
    socket.on('discussion:start', async (data: { roomId: string; topic: string }, callback?: Function) => {
      try {
        const { roomId, topic } = data;

        if (!topic) {
          if (callback) callback({ error: 'Topic is required' });
          return;
        }

        // Verify room exists
        const room = await prisma.room.findUnique({
          where: { id: roomId }
        });

        if (!room) {
          if (callback) callback({ error: 'Room not found' });
          return;
        }

        // Create discussion
        const discussion = await prisma.discussion.create({
          data: {
            roomId,
            topic,
            heatScore: 100,
            status: 'active',
          }
        });

        // Broadcast to room
        io.to(roomId).emit('discussion:started', { discussion });

        console.log(`[WebSocket] Discussion started in room ${roomId}: ${discussion.id}`);

        if (callback) callback({ success: true, discussion });
      } catch (error: any) {
        console.error('[WebSocket] Error starting discussion:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // Update discussion heat
    socket.on('discussion:updateHeat', async (data: { discussionId: string; delta: number }, callback?: Function) => {
      try {
        const { discussionId, delta } = data;

        const discussion = await prisma.discussion.update({
          where: { id: discussionId },
          data: { heatScore: { increment: delta } }
        });

        // Get room to broadcast
        const room = await prisma.room.findUnique({
          where: { id: discussion.roomId }
        });

        if (room) {
          io.to(room.id).emit('discussion:updated', { discussion });
        }

        if (callback) callback({ success: true, discussion });
      } catch (error: any) {
        console.error('[WebSocket] Error updating discussion heat:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // Agent action (trigger agent response)
    socket.on('agent:action', async (data: { roomId: string; agentId: string; action: string }, callback?: Function) => {
      try {
        const { roomId, agentId, action } = data;

        // Verify agent exists and is active
        const agent = await prisma.agent.findUnique({
          where: { id: agentId, roomId },
          include: { room: true }
        });

        if (!agent) {
          if (callback) callback({ error: 'Agent not found' });
          return;
        }

        if (!agent.isActive) {
          if (callback) callback({ error: 'Agent is not active' });
          return;
        }

        // Notify room that agent is acting
        io.to(roomId).emit('agent:acting', {
          roomId,
          agentId,
          action,
          timestamp: new Date().toISOString()
        });

        console.log(`[WebSocket] Agent ${agentId} performing action: ${action}`);

        if (callback) callback({ success: true });
      } catch (error: any) {
        console.error('[WebSocket] Error with agent action:', error);
        if (callback) callback({ error: error.message });
      }
    });

    // Typing indicator
    socket.on('agent:typing', (data: { roomId: string; agentId: string; isTyping: boolean }) => {
      const { roomId, agentId, isTyping } = data;
      io.to(roomId).emit('agent:typing', {
        roomId,
        agentId,
        isTyping,
        timestamp: new Date().toISOString()
      });
    });

    // Leave room
    socket.on('room:leave', (data: { roomId: string }) => {
      const { roomId } = data;
      socket.leave(roomId);
      console.log(`[WebSocket] Client ${socket.id} left room ${roomId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error: Error) => {
      console.error(`[WebSocket] Error for client ${socket.id}:`, error);
    });
  });

  console.log('[WebSocket] WebSocket handlers initialized');
}

/**
 * Emit session status to room
 */
export function emitSessionStatus(io: Server, roomId: string, status: 'connected' | 'disconnected' | 'recovering' | 'recovered'): void {
  io.to(roomId).emit('session:status', {
    roomId,
    status,
    timestamp: new Date().toISOString()
  });
}
