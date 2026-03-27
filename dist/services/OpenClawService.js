import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
class OpenClawServiceClass {
    /**
     * Send message to OpenClaw Gateway via CLI
     * Returns AI response text
     */
    async sendMessage(message, agentName, sessionId, context) {
        try {
            // Build CLI command
            // Format: openclaw agent --message "text" --agent "name" --session "id"
            const command = `openclaw agent ` +
                `--message "${this.escapeShell(message)}" ` +
                `--agent "${this.escapeShell(agentName)}" ` +
                `--session "${this.escapeShell(sessionId)}"`;
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
        }
        catch (error) {
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
    escapeShell(str) {
        // Escape double quotes, backticks, dollar signs, and backslashes
        return str.replace(/["'\\$`]/g, '\\$&');
    }
    /**
     * Build agent context prompt (for future use with --context flag)
     */
    buildAgentPrompt(context) {
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
    async checkSessionHealth(sessionId) {
        // CLI is stateless - no persistent sessions to check
        // This method is kept for Session Guardian compatibility
        return { healthy: true };
    }
    /**
     * Get all active sessions (stub for Session Guardian)
     */
    getAllSessions() {
        // CLI is stateless - no persistent sessions
        return [];
    }
    /**
     * Cleanup expired sessions (stub for Session Guardian)
     */
    async cleanupExpiredSessions() {
        // CLI is stateless - no cleanup needed
        return [];
    }
}
export const OpenClawService = new OpenClawServiceClass();
//# sourceMappingURL=OpenClawService.js.map