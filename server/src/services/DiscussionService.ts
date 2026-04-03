import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { OpenClawService, AgentContext } from './OpenClawService.js';
import { Agent } from '@prisma/client';

/**
 * Discussion Configuration
 */
const DISCUSSION_CONFIG = {
  MIN_TURNS: 4, // Minimum discussion turns
  MAX_TURNS: 8, // Maximum discussion turns
  TURN_DELAY_MS: 3000, // 3 seconds between turns
  PARTICIPANTS: {
    // Number of agents in discussion
    MIN: 2,
    MAX: 4,
  },
};

/**
 * Check if message is a discussion trigger
 */
function parseDiscussionTrigger(message: string): string | null {
  const patterns = [
    /^\/discuss\s+(.+)/i,
    /^let's discuss\s+(.+)/i,
    /^咱们讨论一下\s*(.+)/i,
    /^讨论\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Select agents for discussion based on topic
 */
async function selectDiscussionParticipants(
  topic: string,
  roomId: string,
  count: number = 3
): Promise<Agent[]> {
  const allAgents = await prisma.agent.findMany({
    where: { roomId },
    include: {
      relationshipsAsA: true,
      relationshipsAsB: true,
    },
  });

  if (allAgents.length <= count) {
    return allAgents;
  }

  // Simple selection: random for now (can enhance with topic relevance)
  const shuffled = allAgents.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Run autonomous agent discussion
 */
export async function triggerAgentDiscussion(
  roomId: string,
  topic: string,
  initiatorId?: string,
  sendToExternal?: (chatId: string, content: string) => Promise<void>,
  externalChatId?: string
) {
  try {
    console.log(`[DiscussionService] Starting discussion: "${topic}" in room ${roomId}`);

    // 1. Select discussion participants
    const participantCount =
      Math.floor(
        Math.random() *
          (DISCUSSION_CONFIG.PARTICIPANTS.MAX - DISCUSSION_CONFIG.PARTICIPANTS.MIN + 1)
      ) + DISCUSSION_CONFIG.PARTICIPANTS.MIN;

    const participants = await selectDiscussionParticipants(topic, roomId, participantCount);

    if (participants.length < 2) {
      console.warn('[DiscussionService] Not enough agents for discussion');
      return;
    }

    console.log(`[DiscussionService] Participants: ${participants.map((p) => p.name).join(', ')}`);

    // 2. Announce discussion start (save to DB and emit)
    const io = getIO();
    const startMessageData = {
      roomId,
      senderType: 'system' as const,
      content: `🎙️ **Discussion Started**: ${topic}\nParticipants: ${participants.map((p) => p.name).join(', ')}`,
      metadata: JSON.stringify({
        isDiscussion: true,
        discussionType: 'start',
        topic: topic,
      }),
    };

    const startMessage = await prisma.message.create({
      data: startMessageData,
    });

    console.log('[DiscussionService] Emitting discussion start to room:', roomId);
    io.to(roomId).emit('message:new', {
      ...startMessage,
      agentName: undefined,
    });
    console.log('[DiscussionService] ✅ Discussion start emitted to WebSocket');

    // Send to Feishu if callback provided
    if (sendToExternal && externalChatId) {
      sendToExternal(externalChatId, startMessage.content).catch(console.error);
      console.log('[DiscussionService] ✅ Discussion start sent to Feishu');
    }

    console.log('[DiscussionService] Discussion start message saved');

    // 3. Run discussion turns
    const numTurns =
      Math.floor(Math.random() * (DISCUSSION_CONFIG.MAX_TURNS - DISCUSSION_CONFIG.MIN_TURNS + 1)) +
      DISCUSSION_CONFIG.MIN_TURNS;

    let previousMessage = `Let's discuss: ${topic}`;
    let previousSpeaker = 'User';

    for (let turn = 0; turn < numTurns; turn++) {
      // Select next speaker (not the same as previous)
      const availableSpeakers = participants.filter((p) => p.name !== previousSpeaker);
      const currentSpeaker =
        availableSpeakers.length > 0
          ? availableSpeakers[Math.floor(Math.random() * availableSpeakers.length)]
          : participants[Math.floor(Math.random() * participants.length)];

      // Delay between turns
      if (turn > 0) {
        await new Promise((resolve) => setTimeout(resolve, DISCUSSION_CONFIG.TURN_DELAY_MS));
      }

      // Load recent conversation history
      const recentMessages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          agent: { select: { name: true } },
        },
      });

      const formattedHistory = recentMessages.reverse().map((msg) => ({
        role: msg.senderType === 'human' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      }));

      // Build discussion prompt
      const discussionPrompt = `${previousSpeaker} said: "${previousMessage}"\n\nRespond naturally as ${currentSpeaker.name}, continuing the discussion about "${topic}". Reference what ${previousSpeaker} said.`;

      const allRelationships = [
        ...(currentSpeaker.relationshipsAsA || []),
        ...(currentSpeaker.relationshipsAsB || []),
      ];

      const agentContext = {
        agentName: currentSpeaker.name,
        agentRole: currentSpeaker.role || 'Family member',
        personality: {
          talkativeness: currentSpeaker.talkativeness || 7,
          empathy: currentSpeaker.empathy || 6,
          curiosity: currentSpeaker.curiosity || 8,
        },
        relationships: allRelationships.map((r) => {
          const isAgentA = r.agentAId === currentSpeaker.id;
          const otherAgentId = isAgentA ? r.agentBId : r.agentAId;
          return {
            with: otherAgentId,
            type: r.type,
            strength: r.strength,
          };
        }),
        roomContext: `Family discussion about: ${topic}`,
        recentHistory: formattedHistory,
        currentTopic: topic,
        customPrompt: discussionPrompt,
        isDiscussion: true,
      };

      // Get AI response
      const response = await OpenClawService.sendMessage(
        discussionPrompt,
        currentSpeaker.id,
        roomId,
        agentContext,
        false, // Don't deliver to Feishu yet
        undefined,
        undefined
      );

      // Save to database (metadata must be stringified JSON)
      const discussionMessage = await prisma.message.create({
        data: {
          roomId,
          agentId: currentSpeaker.id,
          senderType: 'agent',
          content: response.content,
          metadata: JSON.stringify({
            isDiscussion: true,
            topic: topic,
            turn: turn + 1,
            totalTurns: numTurns,
          }),
        },
        include: {
          agent: { select: { name: true, avatar: true } },
        },
      });

      // Emit to frontend
      console.log('[DiscussionService] Emitting discussion turn', turn + 1, 'to room:', roomId);
      io.to(roomId).emit('message:new', {
        ...discussionMessage,
        agentName: discussionMessage.agent?.name || currentSpeaker.name,
        agentAvatar: discussionMessage.agent?.avatar || undefined,
        isDiscussion: true,
      });
      console.log('[DiscussionService] ✅ Discussion turn', turn + 1, 'emitted to WebSocket');

      // Send to Feishu if callback provided
      if (sendToExternal && externalChatId) {
        const formattedContent = `${discussionMessage.agent?.avatar || ''} ${discussionMessage.agent?.name || currentSpeaker.name}: ${discussionMessage.content}`;
        sendToExternal(externalChatId, formattedContent).catch(console.error);
        console.log('[DiscussionService] ✅ Discussion turn', turn + 1, 'sent to Feishu');
      }

      console.log(
        `[DiscussionService] Turn ${turn + 1}/${numTurns}: ${currentSpeaker.name} responded`
      );

      previousMessage = response.content;
      previousSpeaker = currentSpeaker.name;
    }

    // 4. Announce discussion end (save to DB and emit)
    const endMessageData = {
      roomId,
      senderType: 'system' as const,
      content: `🎙️ **Discussion Ended**\nGreat conversation everyone!`,
      metadata: JSON.stringify({
        isDiscussion: true,
        discussionType: 'end',
        topic: topic,
      }),
    };

    const endMessage = await prisma.message.create({
      data: endMessageData,
    });

    io.to(roomId).emit('message:new', {
      ...endMessage,
      agentName: undefined,
    });
    console.log('[DiscussionService] ✅ Discussion end emitted to WebSocket');

    // Send to Feishu if callback provided
    if (sendToExternal && externalChatId) {
      sendToExternal(externalChatId, endMessage.content).catch(console.error);
      console.log('[DiscussionService] ✅ Discussion end sent to Feishu');
    }

    console.log('[DiscussionService] Discussion end message saved');

    console.log(`[DiscussionService] ✅ Discussion complete: ${numTurns} turns`);
  } catch (error: any) {
    console.error('[DiscussionService] ❌ Error:', error.message);
  }
}
