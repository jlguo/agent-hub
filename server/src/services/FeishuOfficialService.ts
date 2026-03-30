import * as Lark from '@larksuiteoapi/node-sdk';
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { FeishuService } from './FeishuService.js';

const prisma = new PrismaClient();

/**
 * Normalized message format for MessageService
 */
interface NormalizedMessage {
  roomId: string;
  senderType: 'human' | 'agent';
  content: string;
  metadata?: any;
}

/**
 * Feishu Official SDK Service
 * 
 * Uses @larksuiteoapi/node-sdk for WebSocket-based event handling.
 * No manual authentication needed - SDK handles everything.
 */
export class FeishuOfficialService extends EventEmitter {
  private client?: Lark.Client;
  private wsClient?: Lark.WSClient;
  private appId: string;
  private appSecret: string;
  private feishuService: FeishuService;
  private isRunning = false;

  constructor() {
    super();
    this.appId = process.env.FEISHU_APP_ID || '';
    this.appSecret = process.env.FEISHU_APP_SECRET || '';
    this.feishuService = new FeishuService();

    if (!this.appId || !this.appSecret) {
      console.warn('[FeishuOfficial] Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
    }
  }

  /**
   * Initialize and start WebSocket connection
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[FeishuOfficial] Already running');
      return;
    }

    if (!this.appId || !this.appSecret) {
      console.error('[FeishuOfficial] Cannot start - missing credentials');
      return;
    }

    try {
      console.log('[FeishuOfficial] 🚀 Starting Feishu WebSocket...');

      // Initialize API client for sending messages
      this.client = new Lark.Client({
        appId: this.appId,
        appSecret: this.appSecret,
      });

      // Initialize WebSocket client for receiving events
      this.wsClient = new Lark.WSClient({
        appId: this.appId,
        appSecret: this.appSecret,
        loggerLevel: Lark.LoggerLevel.info,
      });

      // Create event dispatcher with message handler
      const eventDispatcher = new Lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data: any) => {
          console.log('[FeishuOfficial] 📨 Message received:', data.event?.message?.message_id);
          await this.handleMessage(data);
        },
      });

      // Start WebSocket connection
      await this.wsClient.start({
        eventDispatcher,
      });

      this.isRunning = true;
      console.log('[FeishuOfficial] ✅ WebSocket connected and listening');
    } catch (error: any) {
      console.error('[FeishuOfficial] ❌ Failed to start:', error.message);
      throw error;
    }
  }

  /**
   * Handle incoming message event
   */
  private async handleMessage(data: any): Promise<void> {
    const { message } = data.event || data;

    try {
      console.log('[FeishuOfficial] Processing message:', {
        messageId: message.message_id,
        chatId: message.chat_id,
        sender: message.sender?.sender_id || message.sender?.id,
      });

      // Parse message content (Feishu stores as JSON string)
      let content: string;
      try {
        const parsed = JSON.parse(message.content);
        content = parsed.text || message.content;
      } catch {
        content = message.content;
      }

      // Find or create room
      let room = await prisma.room.findFirst({
        where: {
          externalChatId: message.chat_id,
        },
      });

      if (!room) {
        console.log('[FeishuOfficial] Creating room for chat:', message.chat_id);
        room = await prisma.room.create({
          data: {
            name: `Feishu Room ${message.chat_id.slice(0, 8)}`,
            description: 'Auto-created from Feishu chat',
            externalChatId: message.chat_id,
          },
        });
      }

      // Normalize message for MessageService
      const normalizedMessage: NormalizedMessage = {
        roomId: room.id,
        senderType: 'human',
        content,
        metadata: {
          senderId: message.sender?.sender_id || message.sender?.id,
          feishuMessageId: message.message_id,
          chatType: message.chat_type,
          chatId: message.chat_id,
        },
      };

      // Emit event for MessageService to handle
      this.emit('message', normalizedMessage, message.chat_id);

      console.log('[FeishuOfficial] ✅ Message delegated to MessageService');
    } catch (error: any) {
      console.error('[FeishuOfficial] ❌ Error handling message:', error.message);
    }
  }

  /**
   * Send message back to Feishu (called by MessageService)
   */
  async sendToFeishu(chatId: string, content: string): Promise<void> {
    try {
      await this.feishuService.sendMessage(chatId, content);
      console.log('[FeishuOfficial] ✅ Message sent to Feishu:', chatId);
    } catch (error: any) {
      console.error('[FeishuOfficial] ❌ Failed to send to Feishu:', error.message);
      throw error;
    }
  }

  /**
   * Stop WebSocket connection
   */
  async stop(): Promise<void> {
    if (this.wsClient) {
      // Note: WSClient doesn't have a stop method in current SDK
      // Connection will close when process exits
      console.log('[FeishuOfficial] Stopping (SDK will cleanup on exit)');
    }
    this.isRunning = false;
  }
}

// Export singleton instance
export const feishuOfficial = new FeishuOfficialService();
