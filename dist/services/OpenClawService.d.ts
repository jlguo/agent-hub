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
declare class OpenClawServiceClass {
    /**
     * Send message to OpenClaw Gateway via CLI
     * Returns AI response text
     */
    sendMessage(message: string, agentName: string, sessionId: string, context?: AgentContext): Promise<OpenClawResponse>;
    /**
     * Escape special characters for shell command
     */
    private escapeShell;
    /**
     * Build agent context prompt (for future use with --context flag)
     */
    private buildAgentPrompt;
    /**
     * Check session health (stub for Session Guardian)
     * For CLI-based integration, sessions are stateless
     */
    checkSessionHealth(sessionId: string): Promise<{
        healthy: boolean;
        error?: string;
    }>;
    /**
     * Get all active sessions (stub for Session Guardian)
     */
    getAllSessions(): Array<{
        id: string;
        roomId: string;
        createdAt: Date;
    }>;
    /**
     * Cleanup expired sessions (stub for Session Guardian)
     */
    cleanupExpiredSessions(): Promise<string[]>;
}
export declare const OpenClawService: OpenClawServiceClass;
export {};
//# sourceMappingURL=OpenClawService.d.ts.map