/**
 * Feishu Service - Official SDK integration
 * 
 * Handles:
 * - Sending messages to Feishu chats
 * - Uses @larksuiteoapi/node-sdk for reliable API calls
 */

import * as lark from '@larksuiteoapi/node-sdk';

export class FeishuService {
  private client: lark.Client;

  constructor() {
    const appId = process.env.FEISHU_APP_ID || '';
    const appSecret = process.env.FEISHU_APP_SECRET || '';
    
    if (!appId || !appSecret) {
      console.warn('[FeishuService] Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
    }

    // Create SDK client - handles auth automatically
    this.client = new lark.Client({
      appId,
      appSecret,
    });
  }

  /**
   * Send text message to Feishu chat
   */
  async sendMessage(chatId: string, content: string): Promise<void> {
    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text: content }),
          msg_type: 'text',
        },
      });

      console.log('[FeishuService] ✅ Message sent to chat:', chatId);
    } catch (error: any) {
      console.error('[FeishuService] ❌ Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send rich text message (with mentions, formatting)
   */
  async sendRichMessage(chatId: string, richContent: any): Promise<void> {
    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify(richContent),
          msg_type: 'interactive',
        },
      });

      console.log('[FeishuService] ✅ Rich message sent to chat:', chatId);
    } catch (error: any) {
      console.error('[FeishuService] ❌ Failed to send rich message:', error);
      throw error;
    }
  }
}
