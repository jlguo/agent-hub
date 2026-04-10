import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { triggerAgentResponse } from '../services/MessageService.js';
import { triggerAgentDiscussion } from '../services/DiscussionService.js';
import { getIO } from '../lib/socket.js';
import { FeishuService } from '../services/FeishuService.js';

export const router = Router();

// GET /api/messages/rooms/:roomId - Get messages for a room
// GET /api/messages/rooms/:roomId - Get messages for a room
router.get('/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { limit = '200' } = req.query;

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

    // Transform messages to include agentName and agentAvatar at top level for frontend convenience
    const transformedMessages = messages.map((msg) => ({
      ...msg,
      agentName: msg.agent?.name || undefined,
      agentAvatar: msg.agent?.avatar || undefined,
    }));

    res.json(transformedMessages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages/rooms/:roomId/messages - Send a message
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

    // Sync to Feishu if room has externalChatId (Feishu group)
    if (senderType === 'human' && room.externalChatId && room.externalChatId !== 'N/A') {
      const feishuService = new FeishuService();
      feishuService
        .sendMessage(room.externalChatId, content)
        .then(() => console.log('[MessagesRoute] ✅ Web UI message synced to Feishu'))
        .catch((err) => console.error('[MessagesRoute] ❌ Feishu sync failed:', err.message));
    }

    // If human message, check for discussion trigger or normal agent response
    if (senderType === 'human') {
      // Check if this is a discussion trigger
      const discussionTopic =
        content.match(/^\/discuss\s+(.+)/i)?.[1]?.trim() ||
        content.match(/^let's discuss\s+(.+)/i)?.[1]?.trim() ||
        content.match(/^咱们讨论一下\s*(.+)/i)?.[1]?.trim();

      if (discussionTopic) {
        // Trigger autonomous agent discussion
        console.log(`[MessagesRoute] Discussion triggered: "${discussionTopic}"`);

        // Get room to check if Feishu sync is needed
        const roomWithChatId = await prisma.room.findUnique({
          where: { id: roomId },
          select: { externalChatId: true },
        });

        // Send to Feishu if room has externalChatId
        const sendToFeishu =
          roomWithChatId?.externalChatId && roomWithChatId.externalChatId !== 'N/A'
            ? async (chatId: string, content: string) => {
                const feishuService = new FeishuService();
                await feishuService.sendMessage(chatId, content);
              }
            : undefined;

        triggerAgentDiscussion(
          roomId,
          discussionTopic,
          undefined,
          sendToFeishu,
          roomWithChatId?.externalChatId || undefined
        ).catch(console.error);
      } else {
        // Normal agent response
        triggerAgentResponse(roomId, content, room.description || undefined).catch(console.error);
      }
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
