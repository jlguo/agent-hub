import { Prisma } from '@prisma/client';

/**
 * Message Factory
 * Creates consistent test messages with overrides
 */

const defaultMessage = {
  content: 'Test message',
  senderType: 'human' as const,
  metadata: JSON.stringify({ test: true }),
};

export function createMessage(
  roomId: string,
  overrides: Partial<Prisma.MessageCreateInput> = {}
) {
  return {
    ...defaultMessage,
    room: { connect: { id: roomId } },
    ...overrides,
  };
}

export function createHumanMessage(roomId: string, content: string = 'Human message') {
  return createMessage(roomId, {
    content,
    senderType: 'human',
  });
}

export function createAgentMessage(
  roomId: string,
  agentId: string,
  content: string = 'Agent response'
) {
  return createMessage(roomId, {
    content,
    senderType: 'agent',
    agent: { connect: { id: agentId } },
  });
}

export function createDiscussionMessage(
  roomId: string,
  discussionId: string,
  content: string = 'Discussion message',
  senderType: 'human' | 'agent' = 'human'
) {
  return createMessage(roomId, {
    content,
    senderType,
    discussion: { connect: { id: discussionId } },
    metadata: JSON.stringify({ isDiscussion: true }),
  });
}
