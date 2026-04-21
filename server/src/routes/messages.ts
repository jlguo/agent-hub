import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import {
  triggerAgentResponse,
  handleFeishuSync,
  handleDiscussionTrigger,
} from '../services/MessageService.js';
import { getIO } from '../lib/socket.js';
import logger from '../config/logger.js';
import { messageQueryConfig } from '../config/app.config.js';

export const router = Router();

// GET /api/messages/rooms/:roomId - Get messages for a room (with cursor-based pagination)
router.get('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { limit = String(messageQueryConfig.defaultPaginationLimit), cursor } = req.query;

    const parsedLimit = Math.min(parseInt(limit as string, 10), 500); // Cap at 500

    // Build query with optional cursor-based pagination
    const whereClause: any = { roomId };

    if (cursor) {
      // Cursor-based pagination: find the cursor message's createdAt
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor as string },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        whereClause.createdAt = { gt: cursorMessage.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        agent: {
          select: { name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parsedLimit,
    });

    // Transform messages to include agentName and agentAvatar at top level for frontend convenience
    const transformedMessages = messages.map((msg) => ({
      ...msg,
      agentName: msg.agent?.name || undefined,
      agentAvatar: msg.agent?.avatar || undefined,
    }));

    // Include pagination metadata
    const hasMore = messages.length === parsedLimit;
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : null;

    res.json({
      messages: transformedMessages,
      pagination: {
        hasMore,
        nextCursor,
        limit: parsedLimit,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms/:roomId/messages - Send a message
router.post('/rooms/:roomId/messages', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { content, senderType = 'human', agentId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        agents: {
          include: {
            relationshipsAsA: true,
            relationshipsAsB: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const message = await prisma.message.create({
      data: {
        roomId,
        agentId,
        senderType,
        content,
      },
      include: {
        agent: {
          select: { name: true, avatar: true },
        },
      },
    });

    // Emit WebSocket event
    const io = getIO();
    io.to(roomId).emit('message:new', {
      ...message,
      agentName: message.agent?.name || undefined,
      agentAvatar: message.agent?.avatar || undefined,
    });

    // Sync to Feishu if applicable (delegated to MessageService)
    handleFeishuSync(roomId, content, senderType).catch((err) =>
      logger.error('[MessagesRoute] Feishu sync error:', err)
    );

    // If human message, check for discussion trigger or normal agent response
    if (senderType === 'human') {
      const discussionTopic = await handleDiscussionTrigger(
        roomId,
        content,
        room.description || undefined
      );

      if (!discussionTopic) {
        // Normal agent response
        triggerAgentResponse(roomId, content, room.description || undefined).catch((err) =>
          logger.error('[MessagesRoute] Agent response error:', err)
        );
      }
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
