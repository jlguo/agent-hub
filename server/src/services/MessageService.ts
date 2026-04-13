import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { openClawService } from './OpenClawService.js';
import { Agent, Relationship } from '@prisma/client';
import {
  heatConfig,
  getResponseProbability,
  calculateHeatIncrement,
} from '../config/heat.config.js';

/**
 * Extended Agent type with relationships included
 */
type AgentWithRelationships = Agent & {
  relationshipsAsA: Relationship[];
  relationshipsAsB: Relationship[];
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
  return matches.map((match) => match[1].toLowerCase());
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
 * Generate smart fallback response when AI fails
 * Uses agent personality to create relevant fallback
 */
function generateSmartFallback(message: string, agent: Agent): string {
  const agentName = agent.name || 'Agent';
  const talkativeness = agent.talkativeness || 7;
  const empathy = agent.empathy || 6;
  const curiosity = agent.curiosity || 8;

  // Clean up message for context
  const cleanMessage = message.trim();

  // Determine response style based on personality
  if (empathy >= 8) {
    // High empathy - caring, supportive
    return `${agentName}: I hear you. ${cleanMessage.substring(0, 50)}${cleanMessage.length > 50 ? '...' : ''} Let me think about this.`;
  } else if (curiosity >= 8) {
    // High curiosity - asking questions
    return `${agentName}: That's interesting! Tell me more about "${cleanMessage.substring(0, 30).replace(/"/g, '')}"... What made you think of that?`;
  } else if (talkativeness >= 7) {
    // Talkative - sharing thoughts
    return `${agentName}: I understand. To be honest, I've been thinking about ${cleanMessage.substring(0, 40).replace(/"/g, '')} too. We should talk more about this!`;
  } else {
    // Default - neutral response
    return `${agentName}: Okay, I hear you.`;
  }
}

/**
 * Select agent(s) with @mention targeting and smart fallback
 * Returns array of agents to respond (supports multiple agents)
 */
function selectAgentsWithMention(
  message: string,
  agents: AgentWithRelationships[]
): Array<AgentWithRelationships & { selectedByMention: boolean; isFallback?: boolean }> {
  const mentions = parseMentions(message);
  const selectedAgents: Array<
    AgentWithRelationships & { selectedByMention: boolean; isFallback?: boolean }
  > = [];

  if (mentions.length > 0) {
    // Find agents that match @mentions
    for (const mention of mentions) {
      const matchedAgent = agents.find((agent) => {
        const agentNameLower = agent.name.toLowerCase();
        const agentIdLower = agent.id.toLowerCase();
        const agentRoleLower = agent.role?.toLowerCase() || '';
        return (
          agentNameLower.includes(mention) ||
          agentIdLower.includes(mention) ||
          agentRoleLower.includes(mention)
        );
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
          isFallback: true,
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
    const agents = (await prisma.agent.findMany({
      where: { roomId },
      include: {
        relationshipsAsA: true,
        relationshipsAsB: true,
      },
    })) as AgentWithRelationships[];

    if (agents.length === 0) {
      console.warn(`[MessageService] No agents found in room ${roomId}`);
      return;
    }

    // 2. Select responding agent(s) with @mention targeting, cooldown, and smart fallback
    const respondingAgents = selectAgentsWithMention(userMessage, agents);
    console.log(
      `[MessageService] Selected ${respondingAgents.length} agent(s):`,
      respondingAgents.map((a) => `${a.name}${a.isFallback ? ' (fallback)' : ''}`).join(', ')
    );

    // 3. Trigger responses from all selected agents (with delays for natural flow)
    for (let i = 0; i < respondingAgents.length; i++) {
      const respondingAgent = respondingAgents[i];

      // Add delay between multiple agents (2-3 seconds for natural conversation)
      if (i > 0) {
        const delay = 2000 + Math.random() * 1000; // 2-3 seconds
        console.log(
          `[MessageService] Waiting ${Math.round(delay)}ms before ${respondingAgent.name} responds...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
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
        const formattedHistory = recentMessages.reverse().map((msg) => ({
          role: msg.senderType === 'human' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }));

        // Smart fallback: modify userMessage for unknown @mention
        const finalMessage = respondingAgent.isFallback
          ? `${userMessage} (Note: A user mentioned someone with "@${parseMentions(userMessage).join(', @')}" but that person isn't in our family. Politely clarify this and respond helpfully instead.)`
          : userMessage;

        // Get AI response via OpenClaw CLI with error handling
        let response: { content: string };
        try {
          // Generate session ID for agent (format: family-{agentName})
          const sessionId = `family-${respondingAgent.name.toLowerCase()}`;

          const result = await openClawService.sendMessage(
            finalMessage,
            respondingAgent.id,
            sessionId
          );

          if (result.success && result.response) {
            console.log(
              `[MessageService] AI response received from ${respondingAgent.name} (${result.response.length} chars)`
            );
            response = { content: result.response };
          } else {
            throw new Error(result.error || 'OpenClaw send failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[MessageService] ❌ Critical error in agent response:', errorMessage);

          // Use fallback response to maintain user experience
          response = {
            content: generateSmartFallback(finalMessage, respondingAgent),
          };
        }

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

        console.log(`[MessageService] ✅ Agent message saved: ${agentMessage.id}`);
        console.log(
          `[MessageService] 📡 About to emit agent response to WebSocket, roomId: ${roomId}`
        );

        // Emit WebSocket event to frontend
        const io = getIO();
        console.log(
          `[MessageService] 📡 Got IO instance, emitting agent response to room: ${roomId}`
        );
        io.to(roomId).emit('message:new', {
          ...agentMessage,
          agentName: agentMessage.agent?.name || respondingAgent.name,
          agentAvatar: agentMessage.agent?.avatar || undefined,
        });

        console.log(
          `[MessageService] ✅ ${respondingAgent.name} responded successfully${respondingAgent.isFallback ? ' (smart fallback)' : ''}`
        );

        // Check if this agent message contains @mentions that should trigger responses from OTHER agents
        if (agentMessage.senderType === 'agent') {
          const allMentions = parseMentions(agentMessage.content);
          if (allMentions.length > 0) {
            // Filter to only mentioned agents (excluding the current speaker)
            const mentionedAgentsToRespond = agents.filter((agent) => {
              const mentionedName = agent.name.toLowerCase().replace(/\s+/g, '');
              const mentionedRole = agent.role?.toLowerCase().replace(/\s+/g, '') || '';
              const isMentioned = allMentions.some(
                (mention) =>
                  mention === mentionedName ||
                  mention === mentionedRole ||
                  mention === agent.id.toLowerCase()
              );
              // Don't trigger response from the same agent who just spoke
              return isMentioned && agent.id !== respondingAgent.id;
            });

            if (mentionedAgentsToRespond.length > 0) {
              console.log(
                `[MessageService] 🎯 Agent ${respondingAgent.name} mentioned: ${mentionedAgentsToRespond.map((a) => a.name).join(', ')}`
              );
              // Trigger responses from mentioned agents (with 2-3s delay for natural flow)
              for (const mentionedAgent of mentionedAgentsToRespond) {
                // Check cooldown
                if (isOnCooldown(mentionedAgent.id)) {
                  console.log(`[MessageService] ⏱️ ${mentionedAgent.name} on cooldown, skipping`);
                  continue;
                }
                setCooldown(mentionedAgent.id);

                setTimeout(
                  async () => {
                    try {
                      // Build context for mentioned agent
                      const recentMessages = await prisma.message.findMany({
                        where: { roomId },
                        orderBy: { createdAt: 'desc' },
                        take: 15,
                        include: { agent: { select: { name: true } } },
                      });

                      const formattedHistory = recentMessages.reverse().map((msg) => ({
                        role: msg.senderType === 'human' ? 'user' : 'assistant',
                        content: msg.content,
                        timestamp: msg.createdAt.toISOString(),
                      }));

                      const allRelationships = [
                        ...(mentionedAgent.relationshipsAsA || []),
                        ...(mentionedAgent.relationshipsAsB || []),
                      ];

                      // Get AI response with error handling
                      let response: { content: string };
                      try {
                        // Generate session ID for mentioned agent
                        const sessionId = `family-${mentionedAgent.name.toLowerCase()}`;

                        const result = await openClawService.sendMessage(
                          agentMessage.content,
                          mentionedAgent.id,
                          sessionId
                        );

                        if (result.success && result.response) {
                          console.log(
                            `[MessageService] AI response from ${mentionedAgent.name} (${result.response.length} chars)`
                          );
                          response = { content: result.response };
                        } else {
                          throw new Error(result.error || 'OpenClaw send failed');
                        }
                      } catch (error) {
                        const errorMessage =
                          error instanceof Error ? error.message : 'Unknown error';
                        console.error(
                          `[MessageService] ❌ Error in ${mentionedAgent.name} @mention response:`,
                          errorMessage
                        );
                        // Skip this agent's response but continue with others
                        return;
                      }

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

                      console.log(
                        `[MessageService] ✅ ${mentionedAgent.name} responded to @mention from ${respondingAgent.name}`
                      );
                      console.log(
                        `[MessageService] 📡 WebSocket emit to room ${roomId}: ${emitData.content.substring(0, 50)}...`
                      );
                    } catch (error: any) {
                      console.error(
                        `[MessageService] ❌ Error with ${mentionedAgent.name} followup:`,
                        error.message
                      );
                    }
                  },
                  2000 + Math.random() * 1000
                );
              }
            }
          }
        }
      } catch (error: any) {
        console.error(
          `[MessageService] ❌ Error with ${respondingAgent.name} response:`,
          error.message
        );
        // Continue with next agent even if one fails
      }
    }
  } catch (error: any) {
    console.error('[MessageService] ❌ Error triggering agent response:', error.message);
    // Don't rethrow - agent response is best-effort
  }
}

/**
 * Handle message from Feishu (WebSocket integration)
 * Called by FeishuWebSocketService when a message is received
 */
export async function handleFeishuMessage(
  normalizedMessage: {
    roomId: string;
    senderType: 'human' | 'agent';
    content: string;
    metadata?: any;
  },
  feishuChatId: string,
  sendToFeishu: (chatId: string, content: string) => Promise<void>
) {
  try {
    console.log('[MessageService] 📨 Handling Feishu message:', normalizedMessage.content);

    // Save message to database
    const message = await prisma.message.create({
      data: {
        roomId: normalizedMessage.roomId,
        senderType: normalizedMessage.senderType,
        content: normalizedMessage.content,
        metadata: normalizedMessage.metadata ? JSON.stringify(normalizedMessage.metadata) : null,
      },
      include: {
        agent: { select: { name: true, avatar: true } },
      },
    });

    console.log('[MessageService] ✅ Feishu message saved:', message.id);
    console.log(
      '[MessageService] 📡 About to emit to WebSocket, roomId:',
      normalizedMessage.roomId
    );

    // Emit to WebSocket (for Web UI clients)
    const io = getIO();
    console.log('[MessageService] 📡 Got IO instance, emitting to room:', normalizedMessage.roomId);
    io.to(normalizedMessage.roomId).emit('message:new', {
      ...message,
      agentName: message.agent?.name || undefined,
      agentAvatar: message.agent?.avatar || undefined,
    });

    // If human message, check for discussion trigger or normal agent response
    if (normalizedMessage.senderType === 'human') {
      console.log('[MessageService] 🔥 Triggering agent response for Feishu message');

      // Get room for context
      const room = await prisma.room.findUnique({
        where: { id: normalizedMessage.roomId },
        include: {
          agents: {
            include: {
              relationshipsAsA: true,
              relationshipsAsB: true,
            },
          },
        },
      });

      if (!room) {
        console.error('[MessageService] Room not found:', normalizedMessage.roomId);
        return;
      }

      // Check if this is a discussion trigger
      const discussionTopic =
        normalizedMessage.content.match(/^\/discuss\s+(.+)/i)?.[1]?.trim() ||
        normalizedMessage.content.match(/^let's discuss\s+(.+)/i)?.[1]?.trim() ||
        normalizedMessage.content.match(/^咱们讨论一下\s*(.+)/i)?.[1]?.trim();

      if (discussionTopic) {
        // Trigger autonomous agent discussion
        console.log(`[MessageService] Discussion triggered from Feishu: "${discussionTopic}"`);
        import('./DiscussionService.js').then(({ triggerAgentDiscussion }) => {
          triggerAgentDiscussion(
            normalizedMessage.roomId,
            discussionTopic,
            undefined,
            sendToFeishu,
            feishuChatId
          ).catch(console.error);
        });
      } else {
        // Normal agent response with callback to send back to Feishu
        await triggerAgentResponseWithCallback(
          normalizedMessage.roomId,
          normalizedMessage.content,
          room.description || undefined,
          async (agentMessage) => {
            // This callback is called when agent responds
            const agentName = agentMessage.agent?.name || 'Agent';
            const agentAvatar = agentMessage.agent?.avatar || '';

            // Format: "👩 Mom: [message]"
            const formattedContent = `${agentAvatar} ${agentName}: ${agentMessage.content}`;

            // Send to Feishu
            await sendToFeishu(feishuChatId, formattedContent);
            console.log('[MessageService] ✅ Agent response sent to Feishu');
          }
        );
      }
    }
  } catch (error: any) {
    console.error('[MessageService] ❌ Error handling Feishu message:', error.message);
  }
}

/**
 * Trigger agent response with callback for custom delivery (Feishu, etc.)
 */
async function triggerAgentResponseWithCallback(
  roomId: string,
  userMessage: string,
  roomDescription: string | undefined,
  onAgentResponse: (message: any) => Promise<void>
) {
  // Same logic as triggerAgentResponse but with callback instead of WebSocket emit
  // This is a simplified version - in production you'd refactor to share code

  try {
    // Check for @mentions (100% priority)
    const mentions = parseMentions(userMessage);
    const selectedAgents: Agent[] = [];

    if (mentions.length > 0) {
      // Parse @mentions and select mentioned agents
      const allAgents = await prisma.agent.findMany({
        where: { roomId },
        include: {
          relationshipsAsA: true,
          relationshipsAsB: true,
        },
      });

      for (const mention of mentions) {
        const mentionedAgent = allAgents.find(
          (agent) =>
            agent.name.toLowerCase() === mention ||
            agent.id.toLowerCase() === mention ||
            (agent.role && agent.role.toLowerCase() === mention)
        );

        if (mentionedAgent) {
          if (isOnCooldown(mentionedAgent.id)) {
            console.log(`[MessageService] Agent ${mentionedAgent.name} on cooldown, skipping`);
            continue;
          }
          selectedAgents.push(mentionedAgent);
          MENTION_COOLDOWNS.set(mentionedAgent.id, Date.now());
        }
      }
    }

    // If no @mentions, use heat-based probability
    if (selectedAgents.length === 0) {
      // Use default 60% probability (WARM zone)
      // TODO: Integrate with HeatTracker for dynamic probability based on discussion heat
      const responseChance = Math.random();
      const shouldRespond = responseChance < 0.6; // 60% base chance

      if (!shouldRespond) {
        console.log('[MessageService] Random check failed, skipping response');
        return;
      }

      const allAgents = await prisma.agent.findMany({
        where: { roomId },
      });

      if (allAgents.length > 0) {
        const randomAgent = allAgents[Math.floor(Math.random() * allAgents.length)];
        selectedAgents.push(randomAgent);
      }
    }

    // Generate responses for selected agents
    for (const agent of selectedAgents) {
      try {
        // Generate OpenClaw session ID (format: family-{agentName})
        const sessionId = `family-${agent.name.toLowerCase()}`;

        // Get AI response with error handling
        let response: { content: string };
        try {
          const result = await openClawService.sendMessage(userMessage, agent.id, sessionId);

          if (result.success && result.response) {
            response = { content: result.response };
          } else {
            throw new Error(result.error || 'OpenClaw send failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[MessageService] ❌ Error in agent response:', errorMessage);
          // Skip this agent but continue with others
          continue;
        }

        // Save agent response
        const agentMessage = await prisma.message.create({
          data: {
            roomId,
            agentId: agent.id,
            senderType: 'agent',
            content: response.content,
          },
          include: {
            agent: { select: { name: true, avatar: true } },
          },
        });

        console.log(`[MessageService] ✅ Agent message saved: ${agentMessage.id}`);
        console.log(
          `[MessageService] 📡 About to emit agent response to WebSocket, roomId: ${roomId}`
        );

        // Emit WebSocket event to frontend (Web UI)
        const io = getIO();
        console.log(
          `[MessageService] 📡 Got IO instance, emitting agent response to room: ${roomId}`
        );
        io.to(roomId).emit('message:new', {
          ...agentMessage,
          agentName: agentMessage.agent?.name || agent.name,
          agentAvatar: agentMessage.agent?.avatar || undefined,
        });
        console.log(`[MessageService] ✅ WebSocket emit complete for agent response`);

        // Call the delivery callback (Feishu)
        await onAgentResponse(agentMessage);
      } catch (error: any) {
        console.error(`[MessageService] Error with ${agent.name} response:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[MessageService] Error in triggerAgentResponseWithCallback:', error.message);
  }
}
