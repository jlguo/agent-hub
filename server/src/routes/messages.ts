import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { triggerAgentResponse } from '../services/MessageService.js';
import { triggerAgentDiscussion } from '../services/DiscussionService.js';
import { getIO } from '../lib/socket.js';

export const router = Router();

// GET /api/messages/rooms/:roomId - Get messages for a room
router.get('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { limit = '50' } = req.query;

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
        agent: {
          select: { name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit as string),
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms/:roomId/messages - Send a message
router.post('/rooms/:roomId', async (req: Request, res: Response) => {
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
    });

    // If human message, check for discussion trigger or normal agent response
    if (senderType === 'human') {
      // Check if this is a discussion trigger
      const discussionTopic = content.match(/^\/discuss\s+(.+)/i)?.[1]?.trim() ||
                             content.match(/^let's discuss\s+(.+)/i)?.[1]?.trim() ||
                             content.match(/^咱们讨论一下\s*(.+)/i)?.[1]?.trim();
      
      if (discussionTopic) {
        // Trigger autonomous agent discussion
        console.log(`[MessagesRoute] Discussion triggered: "${discussionTopic}"`);
        triggerAgentDiscussion(roomId, discussionTopic)
          .catch(console.error);
      } else {
        // Normal agent response
        triggerAgentResponse(roomId, content, room.description || undefined)
          .catch(console.error);
      }
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
