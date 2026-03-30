import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { OpenClawService, AgentContext } from './OpenClawService.js';
import { Agent } from '@prisma/client';

/**
 * Heat System Configuration
 * Tuned for natural conversation flow
 */
const HEAT_CONFIG = {
  BASE_INCREMENT: 25,          // Base heat per message
  USER_MESSAGE_MULTIPLIER: 2.0, // User messages = 50 heat (WARM zone)
  AGENT_MESSAGE_MULTIPLIER: 0.8, // Agent messages = 20 heat (maintains warmth)
  DECAY_RATE: 0.12,            // 12% decay per 30s cycle (slower decay)
  DECAY_INTERVAL_MS: 30000,    // 30 seconds
  THRESHOLDS: {
    HOT: 70,    // 80% response probability
    WARM: 40,   // 60% response probability
    COLD: 20,   // 40% response probability
    INACTIVE: 5, // 20% response probability
  },
};

/**
 * @Mention Cooldown Tracking
 * Prevents spamming same agent with @mentions
 */
const MENTION_COOLDOWNS: Map<string, number> = new Map(); // agentId -> timestamp
const COOLDOWN_MS = 60000; // 60 seconds cooldown

/**
 * Parse @mentions from message and return mentioned agent IDs
 */
function parseMentions(message: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = [...message.matchAll(mentionRegex)];
  return matches.map(match => match[1].toLowerCase());
}

/**
 * Check if agent is on @mention cooldown
 */
function isOnCooldown(agentId: string): boolean {
  const lastMention = MENTION_COOLDOWNS.get(agentId);
  if (!lastMention) return false;
  
  const now = Date.now();
  const elapsed = now - lastMention;
  
  if (elapsed > COOLDOWN_MS) {
    MENTION_COOLDOWNS.delete(agentId); // Cooldown expired
    return false;
  }
  
  return true;
}

/**
 * Set @mention cooldown for agent
 */
function setCooldown(agentId: string) {
  MENTION_COOLDOWNS.set(agentId, Date.now());
  
  // Cleanup old cooldowns periodically
  if (MENTION_COOLDOWNS.size > 20) {
    const now = Date.now();
    for (const [id, timestamp] of MENTION_COOLDOWNS.entries()) {
      if (now - timestamp > COOLDOWN_MS * 2) {
        MENTION_COOLDOWNS.delete(id);
      }
    }
  }
}

/**
 * Select agent(s) with @mention targeting and smart fallback
 * Returns array of agents to respond (supports multiple agents)
 */
function selectAgentsWithMention(message: string, agents: Agent[]): Array<Agent & { selectedByMention: boolean; isFallback?: boolean }> {
  const mentions = parseMentions(message);
  const selectedAgents: Array<Agent & { selectedByMention: boolean; isFallback?: boolean }> = [];
  
  if (mentions.length > 0) {
    // Find agents that match @mentions
    for (const mention of mentions) {
      const matchedAgent = agents.find(agent => {
        const agentNameLower = agent.name.toLowerCase();
        const agentIdLower = agent.id.toLowerCase();
        const agentRoleLower = agent.role?.toLowerCase() || '';
        return agentNameLower.includes(mention) || 
               agentIdLower.includes(mention) ||
               agentRoleLower.includes(mention);
      });
      
      if (matchedAgent) {
        // Check cooldown
        if (!isOnCooldown(matchedAgent.id)) {
          selectedAgents.push({ ...matchedAgent, selectedByMention: true });
          setCooldown(matchedAgent.id); // Set cooldown after selection
        } else {
          console.log(`[MessageService] Agent ${matchedAgent.name} on cooldown, skipping`);
        }
      } else {
        // Smart fallback for unknown @mentions
        console.log(`[MessageService] Unknown @mention: @${mention}, using smart fallback`);
        // Will add fallback message later
        selectedAgents.push({ 
          ...agents[Math.floor(Math.random() * agents.length)], 
          selectedByMention: true, 
          isFallback: true 
        });
      }
    }
    
    if (selectedAgents.length > 0) {
      return selectedAgents;
    }
  }
  
  // No mentions or all on cooldown - random selection (1 agent)
  const selected = agents[Math.floor(Math.random() * agents.length)];
  return [{ ...selected, selectedByMention: false }];
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
    
    // 2. Select responding agent(s) with @mention targeting, cooldown, and smart fallback
    const respondingAgents = selectAgentsWithMention(userMessage, agents);
    console.log(`[MessageService] Selected ${respondingAgents.length} agent(s):`, 
      respondingAgents.map(a => `${a.name}${a.isFallback ? ' (fallback)' : ''}`).join(', ')
    );
    
    // 3. Trigger responses from all selected agents (with delays for natural flow)
    for (let i = 0; i < respondingAgents.length; i++) {
      const respondingAgent = respondingAgents[i];
      
      // Add delay between multiple agents (2-3 seconds for natural conversation)
      if (i > 0) {
        const delay = 2000 + Math.random() * 1000; // 2-3 seconds
        console.log(`[MessageService] Waiting ${Math.round(delay)}ms before ${respondingAgent.name} responds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        // Build agent context with recent conversation history
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
        
        // Smart fallback: modify prompt for unknown @mention
        let customPrompt = respondingAgent.isFallback 
          ? `A user mentioned someone with "@${parseMentions(userMessage).join(', @')}" but that person isn't in our family. Politely clarify this and respond helpfully instead.` 
          : undefined;
        
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
          currentTopic: undefined,
          customPrompt, // Smart fallback message
        };
        
        // Get AI response via OpenClaw CLI
        const response = await OpenClawService.sendMessage(
          userMessage,
          respondingAgent.id,
          roomId,
          agentContext,
          deliver,
          replyAccount,
          replyTo
        );
        
        console.log(`[MessageService] AI response received from ${respondingAgent.name} (${response.content.length} chars)`);
        
        // Save agent response to database
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
        
        // Emit WebSocket event to frontend
        const io = getIO();
        io.to(roomId).emit('message:new', {
          ...agentMessage,
          agentName: agentMessage.agent?.name || respondingAgent.name,
          agentAvatar: agentMessage.agent?.avatar || undefined,
        });
        
        console.log(`[MessageService] ✅ ${respondingAgent.name} responded successfully${respondingAgent.isFallback ? ' (smart fallback)' : ''}`);
        
        // Check if this agent message contains @mentions that should trigger responses from OTHER agents
        if (agentMessage.senderType === 'agent') {
          const allMentions = parseMentions(agentMessage.content);
          if (allMentions.length > 0) {
            // Filter to only mentioned agents (excluding the current speaker)
            const mentionedAgentsToRespond = agents.filter(agent => {
              const mentionedName = agent.name.toLowerCase().replace(/\s+/g, '');
              const mentionedRole = agent.role?.toLowerCase().replace(/\s+/g, '') || '';
              const isMentioned = allMentions.some(mention => 
                mention === mentionedName || 
                mention === mentionedRole ||
                mention === agent.id.toLowerCase()
              );
              // Don't trigger response from the same agent who just spoke
              return isMentioned && agent.id !== respondingAgent.id;
            });
            
            if (mentionedAgentsToRespond.length > 0) {
              console.log(`[MessageService] 🎯 Agent ${respondingAgent.name} mentioned: ${mentionedAgentsToRespond.map(a => a.name).join(', ')}`);
              // Trigger responses from mentioned agents (with 2-3s delay for natural flow)
              for (const mentionedAgent of mentionedAgentsToRespond) {
                // Check cooldown
                if (isOnCooldown(mentionedAgent.id)) {
                  console.log(`[MessageService] ⏱️ ${mentionedAgent.name} on cooldown, skipping`);
                  continue;
                }
                setCooldown(mentionedAgent.id);
                
                setTimeout(async () => {
                  try {
                    // Build context for mentioned agent
                    const recentMessages = await prisma.message.findMany({
                      where: { roomId },
                      orderBy: { createdAt: 'desc' },
                      take: 15,
                      include: { agent: { select: { name: true } } },
                    });
                    
                    const formattedHistory = recentMessages.reverse().map(msg => {
                      const sender = msg.senderType === 'human' ? 'User' : (msg.agent?.name || 'Agent');
                      return `${sender}: ${msg.content}`;
                    });
                    
                    const allRelationships = [
                      ...(mentionedAgent.relationshipsAsA || []),
                      ...(mentionedAgent.relationshipsAsB || []),
                    ];
                    
                    const agentContext: AgentContext = {
                      agentName: mentionedAgent.name,
                      agentRole: mentionedAgent.role || 'Family member',
                      personality: {
                        talkativeness: mentionedAgent.talkativeness || 7,
                        empathy: mentionedAgent.empathy || 6,
                        curiosity: mentionedAgent.curiosity || 8,
                      },
                      relationships: allRelationships.map((r) => {
                        const isAgentA = r.agentAId === mentionedAgent.id;
                        const otherAgentId = isAgentA ? r.agentBId : r.agentAId;
                        return {
                          with: otherAgentId,
                          type: r.type,
                          strength: r.strength,
                        };
                      }),
                      roomContext: roomContext || 'Family conversation',
                      recentHistory: formattedHistory,
                      currentTopic: undefined,
                      customPrompt: `You were directly mentioned by ${respondingAgent.name}. Respond naturally to what they said.`,
                    };
                    
                    // Get AI response
                    const response = await OpenClawService.sendMessage(
                      agentMessage.content,
                      mentionedAgent.id,
                      roomId,
                      agentContext,
                      deliver,
                      replyAccount,
                      replyTo
                    );
                    
                    // Save and emit
                    const followupMessage = await prisma.message.create({
                      data: {
                        roomId,
                        agentId: mentionedAgent.id,
                        senderType: 'agent',
                        content: response.content,
                      },
                      include: {
                        agent: { select: { name: true, avatar: true } },
                      },
                    });
                    
                    const io = getIO();
                    const emitData = {
                      ...followupMessage,
                      agentName: followupMessage.agent?.name || mentionedAgent.name,
                      agentAvatar: followupMessage.agent?.avatar || undefined,
                    };
                    io.to(roomId).emit('message:new', emitData);
                    
                    console.log(`[MessageService] ✅ ${mentionedAgent.name} responded to @mention from ${respondingAgent.name}`);
                    console.log(`[MessageService] 📡 WebSocket emit to room ${roomId}: ${emitData.content.substring(0, 50)}...`);
                    
                  } catch (error: any) {
                    console.error(`[MessageService] ❌ Error with ${mentionedAgent.name} followup:`, error.message);
                  }
                }, 2000 + Math.random() * 1000);
              }
            }
          }
        }
        
      } catch (error: any) {
        console.error(`[MessageService] ❌ Error with ${respondingAgent.name} response:`, error.message);
        // Continue with next agent even if one fails
      }
    }
    
  } catch (error: any) {
    console.error('[MessageService] ❌ Error triggering agent response:', error.message);
    // Don't rethrow - agent response is best-effort
  }
}
