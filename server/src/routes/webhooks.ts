import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyWebhookToken } from '../middleware/webhookAuth';
import { triggerAgentResponse } from '../services/MessageService';
import { getIO } from '../lib/socket';

const router = express.Router();

/**
 * Webhook payload from OpenClaw Gateway
 */
interface WebhookPayload {
  channel: string;
  accountId: string;
  chatId: string;
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
    };
    timestamp: string;
  };
}

/**
 * POST /api/webhooks/openclaw
 * 
 * Receives inbound messages from OpenClaw Gateway
 * Saves to database and triggers agent response
 */
router.post('/openclaw', verifyWebhookToken, async (req: Request, res: Response) => {
  const payload = req.body as WebhookPayload;
  
  console.log('[Webhook] Received message from OpenClaw:', {
    channel: payload.channel,
    accountId: payload.accountId,
    chatId: payload.chatId,
    messageId: payload.message?.id,
  });
  
  try {
    // 1. Validate payload
    if (!payload.message?.content || !payload.chatId) {
      console.warn('[Webhook] Invalid payload:', payload);
      return res.status(400).json({ 
        error: 'Invalid payload',
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Missing required fields: message.content or chatId'
      });
    }
    
    // 2. Look up room by externalChatId
    const room = await prisma.room.findFirst({
      where: { externalChatId: payload.chatId },
    });
    
    if (!room) {
      console.warn(`[Webhook] Room not found for externalChatId: ${payload.chatId}`);
      return res.status(404).json({ 
        error: 'Room not found',
        code: 'ROOM_NOT_FOUND',
        message: `No room mapped to external chat ID: ${payload.chatId}`
      });
    }
    
    console.log(`[Webhook] Mapped external chat ${payload.chatId} to room ${room.id} (${room.name})`);
    
    // 3. Save message to database
    const savedMessage = await prisma.message.create({
      data: {
        roomId: room.id,
        content: payload.message.content,
        senderType: 'human',
        metadata: JSON.stringify({
          channelId: payload.channel,
          accountId: payload.accountId,
          messageId: payload.message.id,
          sender: payload.message.sender,
          timestamp: payload.message.timestamp,
        }),
      },
    });
    
    console.log(`[Webhook] ✅ Message saved to DB: ${savedMessage.id}`);
    
    // 4. Emit WebSocket event to connected frontend clients
    const io = getIO();
    io.to(room.id).emit('message:new', savedMessage);
    console.log(`[Webhook] 📡 Emitted message:new to room ${room.id}`);
    
    // 5. Trigger agent response (async, non-blocking)
    // Don't wait for response - webhook must acknowledge quickly
    // Enable delivery to send response back to Feishu
    triggerAgentResponse(
      room.id,
      payload.message.content,
      room.context || undefined,
      true,        // deliver: send back to Feishu
      payload.accountId,  // replyAccount: Feishu account
      payload.chatId      // replyTo: Feishu chat/group ID
    )
      .then(() => {
        console.log(`[Webhook] ✅ Agent response completed for message ${savedMessage.id}`);
      })
      .catch((error) => {
        console.error(`[Webhook] ❌ Agent response failed:`, error);
      });
    
    // 5. Acknowledge webhook immediately (within 3s timeout)
    res.status(200).json({ 
      status: 'ok', 
      messageId: savedMessage.id,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('[Webhook] ❌ Error processing webhook:', error);
    
    // Don't retry on validation errors
    if (error.code?.startsWith('INVALID_') || error.code?.startsWith('MISSING_')) {
      return res.status(400).json({
        error: 'Bad Request',
        code: error.code || 'WEBHOOK_PROCESSING_ERROR',
        message: error.message,
      });
    }
    
    // Server errors may trigger retry from OpenClaw
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'WEBHOOK_PROCESSING_ERROR',
      message: error.message,
    });
  }
});

/**
 * GET /api/webhooks/health
 * 
 * Health check endpoint for webhook monitoring
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    endpoint: '/api/webhooks/openclaw',
    timestamp: new Date().toISOString(),
  });
});

export default router;
