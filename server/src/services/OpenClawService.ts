import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

export interface AgentContext {
  agentName: string;
  agentRole: string;
  personality: {
    talkativeness: number;
    empathy: number;
    curiosity: number;
  };
  relationships: Array<{
    with: string;
    type: string;
    strength: number;
  }>;
  roomContext?: string;
  recentHistory: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  currentTopic?: string;
}

export interface OpenClawResponse {
  content: string;
  usage?: {
    totalTokens: number;
    cost: number;
  };
}

class OpenClawServiceClass {
  private mode: 'http' | 'cli';
  private gatewayUrl?: string;
  private verificationToken?: string;

  constructor() {
    // Default to CLI mode for backward compatibility
    this.mode = (process.env.OPENCLAW_MODE as 'http' | 'cli') || 'cli';
    this.gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:4000';
    this.verificationToken = process.env.OPENCLAW_VERIFICATION_TOKEN;

    console.log(`[OpenClawService] Mode: ${this.mode.toUpperCase()}`);

    if (this.mode === 'http' && !this.verificationToken) {
      throw new Error('OPENCLAW_VERIFICATION_TOKEN required for HTTP mode');
    }
  }

  /**
   * Send message to OpenClaw (HTTP Gateway or CLI)
   * Returns AI response text
   *
   * @param deliver - If true, sends the response back to the channel (for webhook flow)
   * @param replyAccount - Account ID to use for delivery (e.g., "family")
   * @param replyTo - Chat ID to deliver to (e.g., Feishu group ID)
   */
  async sendMessage(
    message: string,
    agentName: string,
    sessionId: string,
    context?: AgentContext,
    deliver: boolean = false,
    replyAccount?: string,
    replyTo?: string
  ): Promise<OpenClawResponse> {
    // Route to appropriate implementation based on mode
    if (this.mode === 'http') {
      return this.sendViaHttp(
        message,
        agentName,
        sessionId,
        context,
        deliver,
        replyAccount,
        replyTo
      );
    } else {
      return this.sendViaCli(
        message,
        agentName,
        sessionId,
        context,
        deliver,
        replyAccount,
        replyTo
      );
    }
  }

  /**
   * Send via HTTP Gateway API
   */
  private async sendViaHttp(
    message: string,
    agentName: string,
    sessionId: string,
    context?: AgentContext,
    deliver?: boolean,
    replyAccount?: string,
    replyTo?: string
  ): Promise<OpenClawResponse> {
    const startTime = Date.now();

    try {
      console.log(`[OpenClaw HTTP] Sending to ${this.gatewayUrl}/api/openclaw/gateway`);

      // Build request body
      const requestBody: any = {
        message,
        agent: agentName,
        sessionId,
        deliver,
      };

      if (context) {
        requestBody.context = context;
      }

      if (replyAccount) {
        requestBody.replyAccount = replyAccount;
      }

      if (replyTo) {
        requestBody.replyTo = replyTo;
      }

      // Make HTTP request
      const response = await fetch(`${this.gatewayUrl}/api/openclaw/gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.verificationToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as { content: string; usage?: any };
      const duration = Date.now() - startTime;

      console.log(`[OpenClaw HTTP] ✅ Response in ${duration}ms`);

      return {
        content: result.content,
        usage: result.usage,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[OpenClaw HTTP] ❌ Error after ${duration}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Send via CLI (original implementation)
   */
  private async sendViaCli(
    message: string,
    agentName: string,
    sessionId: string,
    context?: AgentContext,
    deliver: boolean = false,
    replyAccount?: string,
    replyTo?: string
  ): Promise<OpenClawResponse> {
    const startTime = Date.now();

    try {
      // Build CLI command with context
      // Format: openclaw agent --message "text" --agent "name" --session-id "id" [--deliver] [--reply-account "account"] [--reply-to "chatId"]

      // Build enhanced message with agent context (personality + relationships)
      let enhancedMessage = message;
      if (context) {
        const contextPrompt = this.buildAgentPrompt(context);
        enhancedMessage = `${contextPrompt}\n\nUser Message: ${message}`;
        console.log(`[OpenClaw CLI] Added agent context (${contextPrompt.length} chars)`);
      }

      let command =
        `openclaw agent ` +
        `--message "${this.escapeShell(enhancedMessage)}" ` +
        `--agent "${this.escapeShell(agentName)}" ` +
        `--session-id "${this.escapeShell(sessionId)}"`;

      if (deliver) {
        command += ` --deliver`;
      }

      if (replyAccount) {
        command += ` --reply-account "${this.escapeShell(replyAccount)}"`;
      }

      if (replyTo) {
        command += ` --reply-to "${this.escapeShell(replyTo)}"`;
      }

      console.log(`[OpenClaw CLI] Executing: ${command}`);
      const startTime = Date.now();

      // Execute command with extended timeout
      // OpenClaw needs time for: plugin loading + agent init + LLM call + response processing
      let stdout: string = '';
      let stderr: string = '';

      try {
        const result = await execAsync(command, {
          timeout: 120000, // 120s timeout (was 30s - too short for LLM calls)
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (execError: any) {
        console.error(`[OpenClaw CLI] Command failed: ${execError.message}`);
        if (execError.stdout) stdout = execError.stdout;
        if (execError.stderr) stderr = execError.stderr;
        if (!stdout) {
          throw new Error(`OpenClaw CLI execution failed: ${execError.message}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const durationNum = parseFloat(duration);

      // Log performance warning for slow responses
      if (durationNum > 30) {
        console.warn(`[OpenClaw CLI] ⚠️ Slow response: ${duration}s (plugins init + LLM call)`);
      } else {
        console.log(`[OpenClaw CLI] Completed in ${duration}s`);
      }

      if (stderr) {
        console.error('[OpenClaw CLI] stderr:', stderr);
      }

      // Handle case where stdout is undefined or empty
      if (!stdout) {
        console.warn('[OpenClaw CLI] No stdout from command');
        return {
          content: 'No response from agent',
        };
      }

      let responseText = stdout.trim();

      // Filter out plugin loading noise and ANSI codes
      responseText = responseText
        .split('\n')
        .filter((line) => {
          // Skip plugin loading messages, ANSI codes, and log lines
          if (line.includes('[plugins]')) return false;
          if (line.includes('memory-lancedb')) return false;
          if (line.includes('lossless-claw')) return false;
          if (line.includes('feishu_')) return false;
          if (line.trim().startsWith('[')) return false;
          if (line.includes('\u001b[')) return false; // ANSI escape codes
          return line.trim().length > 0;
        })
        .join('\n')
        .trim();

      if (!responseText) {
        console.warn('[OpenClaw CLI] Empty response from Gateway');
        return {
          content: 'No response from agent',
        };
      }

      console.log(`[OpenClaw CLI] ✅ Response received (${responseText.length} chars)`);

      return {
        content: responseText,
      };
    } catch (error: any) {
      console.error('[OpenClaw CLI] Error:', error.message);

      // Handle timeout
      if (error.code === 'ETIMEDOUT' || error.killed === true) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`[OpenClaw CLI] ❌ Timeout after ${duration}s (limit: 120s)`);
        throw new Error(
          `OpenClaw CLI timeout (>120s, took ${duration}s) - LLM call may still be processing`
        );
      }

      // Handle command not found
      if (error.code === 'ENOENT') {
        throw new Error('OpenClaw CLI not found. Please install OpenClaw: npm install -g openclaw');
      }

      // Fail fast - rethrow with context
      throw new Error(`OpenClaw CLI failed: ${error.message}`);
    }
  }

  /**
   * Escape special characters for shell command
   */
  private escapeShell(str: string): string {
    // Escape double quotes, backticks, dollar signs, and backslashes
    return str.replace(/["'\\$`]/g, '\\$&');
  }

  /**
   * Build agent context prompt (for future use with --context flag)
   */
  private buildAgentPrompt(context: AgentContext): string {
    const {
      agentName,
      agentRole,
      personality,
      relationships,
      roomContext,
      currentTopic,
      recentHistory,
    } = context;

    let prompt = `You are ${agentName}, ${agentRole}.\n\n`;

    // Personality traits
    prompt += `Personality:\n`;
    prompt += `- Talkativeness: ${personality.talkativeness}/10\n`;
    prompt += `- Empathy: ${personality.empathy}/10\n`;
    prompt += `- Curiosity: ${personality.curiosity}/10\n\n`;

    // Relationships
    if (relationships && relationships.length > 0) {
      prompt += `Relationships:\n`;
      relationships.forEach((rel) => {
        prompt += `- ${rel.with}: ${rel.type} (${rel.strength}% close)\n`;
      });
      prompt += '\n';
    }

    // Room context
    if (roomContext) {
      prompt += `Context: ${roomContext}\n\n`;
    }

    // Current topic
    if (currentTopic) {
      prompt += `Current discussion topic: ${currentTopic}\n\n`;
    }

    // Recent conversation history (CRITICAL for context-aware responses)
    if (recentHistory && recentHistory.length > 0) {
      prompt += `Recent Conversation History:\n`;
      recentHistory.forEach((msg) => {
        prompt += `  ${msg}\n`;
      });
      prompt += '\n';
    }

    // @Mention support
    prompt += `@Mention Feature:\n`;
    prompt += `- You can @mention family members to address them directly (e.g., "@Mom", "@Bro")\n`;
    prompt += `- When someone @mentions you, respond directly to them\n`;
    prompt += `- Use @mentions to include specific family members in conversations\n\n`;

    // Response guidelines
    prompt += `Guidelines:\n`;
    prompt += `- Respond naturally as ${agentName}\n`;
    prompt += `- Keep responses conversational (1-3 sentences)\n`;
    prompt += `- Show your personality traits\n`;
    prompt += `- Reference relationships when relevant\n`;
    prompt += `- Use conversation history to understand context\n`;
    prompt += `- Stay on topic but allow natural conversation flow\n`;
    prompt += `- Reference previous messages when relevant\n`;

    return prompt;
  }

  /**
   * Check session health (stub for Session Guardian)
   * For CLI-based integration, sessions are stateless
   */
  async checkSessionHealth(sessionId: string): Promise<{ healthy: boolean; error?: string }> {
    // CLI is stateless - no persistent sessions to check
    // This method is kept for Session Guardian compatibility
    return { healthy: true };
  }

  /**
   * Get all active sessions (stub for Session Guardian)
   */
  getAllSessions(): Array<{ id: string; roomId: string; createdAt: Date }> {
    // CLI is stateless - no persistent sessions
    return [];
  }

  /**
   * Cleanup expired sessions (stub for Session Guardian)
   */
  async cleanupExpiredSessions(): Promise<string[]> {
    // CLI is stateless - no cleanup needed
    return [];
  }
}

export const OpenClawService = new OpenClawServiceClass();
