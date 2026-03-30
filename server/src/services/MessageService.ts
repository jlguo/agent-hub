import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { OpenClawService, AgentContext } from './OpenClawService.js';
import { Agent } from '@prisma/client';

/**
 * Parse @mentions from message and return mentioned agent IDs
 */
function parseMentions(message: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = [...message.matchAll(mentionRegex)];
  return matches.map(match => match[1].toLowerCase());
}

/**
 * Select agent with @mention targeting
 * - If @mentioned, target agent has 100% selection priority
 * - Otherwise, random selection (MVP)
 */
function selectAgentWithMention(message: string, agents: Agent[]): Agent {
  const mentions = parseMentions(message);
  
  if (mentions.length > 0) {
    // Find agents that match @mentions
    const mentionedAgents = agents.filter(agent => {
      const agentNameLower = agent.name.toLowerCase();
      const agentIdLower = agent.id.toLowerCase();
      return mentions.some(mention => 
        agentNameLower.includes(mention) || 
        agentIdLower.includes(mention) ||
        agent.role?.toLowerCase().includes(mention)
      );
    });
    
    if (mentionedAgents.length > 0) {
      // If multiple mentions, pick the first one (or could randomize)
      const selected = mentionedAgents[0];
      return { ...selected, selectedByMention: true } as Agent & { selectedByMention: boolean };
    }
  }
  
  // No mentions or no match - random selection
  const selected = agents[Math.floor(Math.random() * agents.length)];
  return { ...selected, selectedByMention: false } as Agent & { selectedByMention: boolean };
}

/**
 * Trigger AI response from an agent in the room
 * 
 * This function:
 * 1. Selects a responding agent (random for MVP)
 * 2. Builds agent context with personality and relationships
 * 3. Calls OpenClaw CLI to get AI response
 * 4. Saves response to database
 * 5. Emits WebSocket event to frontend
 * 6. Optionally delivers response back to Feishu channel
 * 
 * @param deliver - If true, sends response back to Feishu via OpenClaw
 * @param replyAccount - Feishu account ID to use for delivery (e.g., "family")
 */
export async function triggerAgentResponse(
  roomId: string,
  userMessage: string,
  roomContext?: string,
  deliver: boolean = false,
  replyAccount?: string,
  replyTo?: string
) {
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
    
    // 2. Select responding agent with @mention targeting
    const respondingAgent = selectAgentWithMention(userMessage, agents);
    console.log(`[MessageService] Selected agent: ${respondingAgent.name}`, {
      reason: respondingAgent.selectedByMention ? '@mention' : 'normal selection',
    });
    
    // 3. Build agent context with recent conversation history
    const allRelationships = [
      ...(respondingAgent.relationshipsAsA || []),
      ...(respondingAgent.relationshipsAsB || []),
    ];
    
    // Load recent messages from the same discussion (last 20 messages)
    const recentMessages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        agent: {
          select: { name: true, avatar: true },
        },
      },
    });
    
    // Format messages for agent context (newest first, then reverse for chronological)
    const formattedHistory = recentMessages.reverse().map(msg => {
      const sender = msg.senderType === 'human' 
        ? 'User' 
        : (msg.agent?.name || 'Agent');
      return `${sender}: ${msg.content}`;
    });
    
    const agentContext: AgentContext = {
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
      recentHistory: formattedHistory,
      currentTopic: undefined, // TODO: Track current topic
    };
    
    // 4. Get AI response via OpenClaw CLI
    // Use agent.id which now matches OpenClaw agent ID (family-dad, family-mom, etc.)
    const response = await OpenClawService.sendMessage(
      userMessage,
      respondingAgent.id,
      roomId,
      agentContext,
      deliver,
      replyAccount,
      replyTo
    );
    
    console.log(`[MessageService] AI response received (${response.content.length} chars)`);
    
    // 5. Save agent response to database
    const agentMessage = await prisma.message.create({
      data: {
        roomId,
        agentId: respondingAgent.id,
        senderType: 'agent',
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
    
  } catch (error: any) {
    console.error('[MessageService] ❌ Error triggering agent response:', error.message);
    // Don't rethrow - agent response is best-effort
  }
}
