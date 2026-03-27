import { exec } from 'child_process';
import { promisify } from 'util';

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
  /**
   * Send message to OpenClaw Gateway via CLI
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
    try {
      // Build CLI command
      // Format: openclaw agent --message "text" --agent "name" --session-id "id" [--deliver] [--reply-account "account"] [--reply-to "chatId"]
      let command = 
        `openclaw agent ` +
        `--message "${this.escapeShell(message)}" ` +
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
      
      // Execute command
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30s timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      if (stderr) {
        console.error('[OpenClaw CLI] stderr:', stderr);
      }
      
      const responseText = stdout.trim();
      
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
        throw new Error('OpenClaw CLI timeout (>30s)');
      }
      
      // Handle command not found
      if (error.code === 'ENOENT') {
        throw new Error('OpenClaw CLI not found. Please install OpenClaw: npm install -g openclaw');
      }
      
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
    const { agentName, agentRole, personality, relationships, roomContext, currentTopic } = context;

    let prompt = `You are ${agentName}, ${agentRole}.\n\n`;
    
    // Personality traits
    prompt += `Personality:\n`;
    prompt += `- Talkativeness: ${personality.talkativeness}/10\n`;
    prompt += `- Empathy: ${personality.empathy}/10\n`;
    prompt += `- Curiosity: ${personality.curiosity}/10\n\n`;

    // Relationships
    if (relationships.length > 0) {
      prompt += `Relationships:\n`;
      relationships.forEach(rel => {
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

    // Response guidelines
    prompt += `Guidelines:\n`;
    prompt += `- Respond naturally as ${agentName}\n`;
    prompt += `- Keep responses conversational (1-3 sentences)\n`;
    prompt += `- Show your personality traits\n`;
    prompt += `- Reference relationships when relevant\n`;
    prompt += `- Stay on topic but allow natural conversation flow\n`;

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
