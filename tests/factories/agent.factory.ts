import { Prisma } from '@prisma/client';

/**
 * Agent Factory
 * Creates consistent test data with overrides
 */

const defaultAgent: Prisma.AgentCreateInput = {
  id: 'test-agent',
  name: 'Test Agent',
  role: 'father',
  avatar: '👨',
  talkativeness: 50,
  empathy: 50,
  curiosity: 50,
  description: 'Test agent for unit tests',
};

export function createAgent(overrides: Partial<Prisma.AgentCreateInput> = {}) {
  return {
    ...defaultAgent,
    ...overrides,
  };
}

export function createMomAgent(roomId: string) {
  return createAgent({
    id: 'test-mom',
    name: 'Mom',
    role: 'mother',
    avatar: '👩',
    talkativeness: 60,
    empathy: 80,
    curiosity: 60,
    room: { connect: { id: roomId } },
  });
}

export function createDadAgent(roomId: string) {
  return createAgent({
    id: 'test-dad',
    name: 'Dad',
    role: 'father',
    avatar: '👨',
    talkativeness: 70,
    empathy: 60,
    curiosity: 50,
    room: { connect: { id: roomId } },
  });
}

export function createBroAgent(roomId: string) {
  return createAgent({
    id: 'test-bro',
    name: 'Bro',
    role: 'brother',
    avatar: '👦',
    talkativeness: 60,
    empathy: 50,
    curiosity: 70,
    room: { connect: { id: roomId } },
  });
}

export function createSisAgent(roomId: string) {
  return createAgent({
    id: 'test-sis',
    name: 'Sis',
    role: 'sister',
    avatar: '👧',
    talkativeness: 70,
    empathy: 60,
    curiosity: 80,
    room: { connect: { id: roomId } },
  });
}
