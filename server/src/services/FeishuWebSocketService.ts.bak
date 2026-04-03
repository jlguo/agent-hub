import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { FeishuService } from './FeishuService.js';

const prisma = new PrismaClient();

/**
 * Feishu WebSocket Message Event
 */
interface FeishuMessageEvent {
  schema: string;
  header: {
    message_id: string;
    message_type: string;
    create_time: string;
    token: string;
  };
  event: {
    message: {
      message_id: string;
      message_type: string;
      content: string;
      chat_type: string;
      chat_id: string;
      sender: {
        id: string;
        sender_type: string;
        tenant_key?: string;
        user_id?: string;
      };
      create_time: string;
    };
  };
  type: string;
}

/**
 * Normalized message format for MessageService
 */
interface NormalizedMessage {
  roomId: string;
  senderType: 'human' | 'agent';
  content: string;
  agentId?: string;
  metadata?: any;
}

/**
 * Feishu WebSocket Service
 * 
 * Maintains persistent WebSocket connection to Feishu for real-time message reception.
 * Uses HTTP API for sending messages (hybrid approach).
 * 
 * Integration: Delegates to MessageService.ts for all message processing logic.
 */
export class FeishuWebSocketService extends EventEmitter {
  private ws?: WebSocket;
  private wsUrl: string;
  private appId: string;
  private appSecret: string;
  private verifyToken: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private heartbeatInterval?: NodeJS.Timeout;
  private isConnected = false;
  private ticket: string = '';
  private ticketExpiresAt?: number;
  private feishuService: FeishuService;

  constructor() {
    super();
    this.appId = process.env.FEISHU_APP_ID || '';
    this.appSecret = process.env.FEISHU_APP_SECRET || '';
    this.verifyToken = process.env.FEISHU_VERIFY_TOKEN || '';
    this.wsUrl = 'wss://open.feishu.cn/ws';
    this.feishuService = new FeishuService();
    
    if (!this.appId || !this.appSecret) {
      console.warn('[FeishuWS] Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
    }
  }

  /**
   * Get WebSocket ticket from Feishu API
   */
  private async getTicket(): Promise<string> {
    // Check if we have a valid cached ticket
    if (this.ticket && this.ticketExpiresAt && Date.now() < this.ticketExpiresAt) {
      return this.ticket;
    }

    console.log('[FeishuWS] Fetching new WebSocket ticket...');
    
    try {
      // First get tenant access token
      const tokenResponse = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: this.appId,
          app_secret: this.appSecret,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const tenantToken = tokenResponse.data.tenant_access_token;
      if (!tenantToken) {
        throw new Error('Failed to get tenant access token');
      }

      // Now get WebSocket ticket
      const ticketResponse = await axios.post(
        'https://open.feishu.cn/open-apis/connect/v1/ws_ticket',
        {},
        {
          headers: {
            'Authorization': `Bearer ${tenantToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.ticket = ticketResponse.data.ticket!;
      const expiresInSeconds = ticketResponse.data.expire_seconds || 3600;
      this.ticketExpiresAt = Date.now() + (expiresInSeconds - 300) * 1000; // Refresh 5 min early

      console.log('[FeishuWS] Ticket obtained, expires in', expiresInSeconds, 'seconds');
      return this.ticket;
    } catch (error: any) {
      console.error('[FeishuWS] Failed to get ticket:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Connect to Feishu WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('[FeishuWS] Already connected');
      return;
    }

    try {
      // Get WebSocket ticket
      const ticket = await this.getTicket();
      const connectUrl = `${this.wsUrl}?ticket=${ticket}`;
      
      console.log('[FeishuWS] Connecting to:', connectUrl.replace(ticket, '***'));
      
      this.ws = new WebSocket(connectUrl);

      this.ws.on('open', () => {
        console.log('[FeishuWS] ✅ Connected to Feishu WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      });

      this.ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message);
        } catch (error) {
          console.error('[FeishuWS] Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[FeishuWS] WebSocket closed');
        this.isConnected = false;
        this.stopHeartbeat();
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[FeishuWS] WebSocket error:', error.message);
      });

    } catch (error: any) {
      console.error('[FeishuWS] Failed to connect:', error.message);
      this.attemptReconnect();
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(message: FeishuMessageEvent): Promise<void> {
    // Handle connection challenge
    if (message.type === 'connection_challenge') {
      console.log('[FeishuWS] Received connection challenge');
      this.sendChallengeResponse(message.header.message_id);
      return;
    }

    // Handle message events
    if (message.type === 'im.message.receive_v1') {
      console.log('[FeishuWS] Received message:', message.event.message.message_id);
      await this.processMessage(message);
      return;
    }

    // Handle ack
    if (message.type === 'ack') {
      console.log('[FeishuWS] Received ack:', message.header?.message_id);
      return;
    }

    console.log('[FeishuWS] Unknown message type:', message.type);
  }

  /**
   * Send challenge response
   */
  private sendChallengeResponse(challengeId: string): void {
    if (!this.ws) return;

    const response = {
      type: 'connection_challenge_response',
      challenge_id: challengeId,
    };

    this.ws.send(JSON.stringify(response));
    console.log('[FeishuWS] Sent challenge response');
  }

  /**
   * Process incoming message and delegate to MessageService
   */
  private async processMessage(event: FeishuMessageEvent): Promise<void> {
    const { event: eventData } = event;
    const { message } = eventData;

    console.log('[FeishuWS] Processing message:', {
      messageId: message.message_id,
      chatId: message.chat_id,
      senderId: message.sender.id,
      content: message.content,
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
        settings: {
          contains: message.chat_id,
        },
      },
    });

    if (!room) {
      console.log('[FeishuWS] Creating room for chat:', message.chat_id);
      room = await prisma.room.create({
        data: {
          name: `Feishu Room ${message.chat_id.slice(0, 8)}`,
          description: 'Auto-created from Feishu chat',
          settings: JSON.stringify({ chatId: message.chat_id }),
        },
      });
    }

    // Normalize message for MessageService
    const normalizedMessage: NormalizedMessage = {
      roomId: room.id,
      senderType: 'human',
      content,
      metadata: {
        senderId: message.sender.id,
        feishuMessageId: message.message_id,
        chatType: message.chat_type,
        chatId: message.chat_id,
      },
    };

    // Emit event for MessageService to handle
    this.emit('message', normalizedMessage, message.chat_id);
    
    console.log('[FeishuWS] Message delegated to MessageService');
  }

  /**
   * Send message back to Feishu (called by MessageService after agent response)
   */
  async sendToFeishu(chatId: string, content: string): Promise<void> {
    try {
      await this.feishuService.sendMessage(chatId, content);
      console.log('[FeishuWS] Message sent to Feishu:', chatId);
    } catch (error: any) {
      console.error('[FeishuWS] Failed to send to Feishu:', error.message);
      throw error;
    }
  }

  /**
   * Attempt to reconnect after disconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[FeishuWS] Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[FeishuWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        // Send ping to keep connection alive
        this.ws.ping();
        console.log('[FeishuWS] Heartbeat sent');
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.isConnected = false;
  }
}

// Export singleton instance
export const feishuWebSocket = new FeishuWebSocketService();
