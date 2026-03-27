import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { OpenClawService } from './OpenClawService.js';
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
export async function triggerAgentResponse(roomId, userMessage, roomContext) {
    try {
        console.log(`[MessageService] Triggering agent response for room ${roomId}`);
        // 1. Get all agents in room
        const agents = await prisma.agent.findMany({
            where: { roomId },
            include: {
                relationshipsAsA: true,
                relationshipsAsB: true,
            },
        });
        if (agents.length === 0) {
            console.warn(`[MessageService] No agents found in room ${roomId}`);
            return;
        }
        // 2. Select responding agent (MVP: random selection)
        const respondingAgent = agents[Math.floor(Math.random() * agents.length)];
        console.log(`[MessageService] Selected agent: ${respondingAgent.name}`);
        // 3. Build agent context
        const allRelationships = [
            ...(respondingAgent.relationshipsAsA || []),
            ...(respondingAgent.relationshipsAsB || []),
        ];
        const agentContext = {
            agentName: respondingAgent.name,
            agentRole: respondingAgent.role || 'Family member',
            personality: {
                talkativeness: respondingAgent.talkativeness || 7,
                empathy: respondingAgent.empathy || 6,
                curiosity: respondingAgent.curiosity || 8,
            },
            relationships: allRelationships.map((r) => {
                // Get the other agent's name (not the current agent)
                const isAgentA = r.agentAId === respondingAgent.id;
                const otherAgentId = isAgentA ? r.agentBId : r.agentAId;
                return {
                    with: otherAgentId,
                    type: r.type,
                    strength: r.strength,
                };
            }),
            roomContext: roomContext || 'Family conversation',
            recentHistory: [], // TODO: Load recent messages from DB
            currentTopic: undefined, // TODO: Track current topic
        };
        // 4. Get AI response via OpenClaw CLI
        const response = await OpenClawService.sendMessage(userMessage, respondingAgent.name, roomId, agentContext);
        console.log(`[MessageService] AI response received (${response.content.length} chars)`);
        // 5. Save agent response to database
        const agentMessage = await prisma.message.create({
            data: {
                roomId,
                agentId: respondingAgent.id,
                role: 'assistant',
                content: response.content,
            },
            include: {
                agent: {
                    select: { name: true, avatar: true },
                },
            },
        });
        // 6. Emit WebSocket event to frontend
        const io = getIO();
        io.to(roomId).emit('message:new', {
            ...agentMessage,
            agentName: agentMessage.agent?.name || respondingAgent.name,
        });
        console.log(`[MessageService] ✅ Agent ${respondingAgent.name} responded successfully`);
    }
    catch (error) {
        console.error('[MessageService] ❌ Error triggering agent response:', error.message);
        // Don't rethrow - agent response is best-effort
    }
}
//# sourceMappingURL=MessageService.js.map