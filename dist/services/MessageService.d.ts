/**
 * Trigger AI response from an agent in the room
 *
 * This function:
 * 1. Selects a responding agent (random for MVP)
 * 2. Builds agent context with personality and relationships
 * 3. Calls OpenClaw CLI to get AI response
 * 4. Saves response to database
 * 5. Emits WebSocket event to frontend
 */
export declare function triggerAgentResponse(roomId: string, userMessage: string, roomContext?: string): Promise<void>;
//# sourceMappingURL=MessageService.d.ts.map