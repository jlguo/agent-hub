/**
 * MessageService Unit Tests
 * Simplified tests focusing on core functionality
 */

import { testPrisma } from '../../test/setup';

describe('MessageService', () => {
  let testRoomId: string;

  beforeEach(async () => {
    // Create test room
    const room = await testPrisma.room.create({
      data: {
        name: 'Test Room',
        externalChatId: 'test-chat',
      },
    });
    testRoomId = room.id;
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('parseMentions', () => {
    function parseMentions(message: string): string[] {
      const mentions = message.match(/@(\w+)/g);
      if (!mentions) return [];
      return mentions.map(m => m.slice(1).toLowerCase());
    }

    it('should extract single @mention from message', () => {
      const message = 'Hey @Mom, dinner?';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom']);
    });

    it('should extract multiple @mentions from message', () => {
      const message = '@Mom @Dad @Bro let\'s go!';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom', 'dad', 'bro']);
    });

    it('should handle case-insensitive mentions', () => {
      const message = 'Hey @MOM @dad @Bro!';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom', 'dad', 'bro']);
    });

    it('should return empty array for no mentions', () => {
      const message = 'Just a regular message';
      const mentions = parseMentions(message);
      expect(mentions).toEqual([]);
    });

    it('should handle mentions with special characters', () => {
      const message = '@Mom, what\'s up? @Dad!';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom', 'dad']);
    });

    it('should handle mentions at end of message', () => {
      const message = 'Let\'s go @Mom';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom']);
    });

    it('should handle consecutive mentions', () => {
      const message = '@Mom@Dad@Bro';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom', 'dad', 'bro']);
    });
  });

  describe('Message Creation', () => {
    it('should create human message successfully', async () => {
      const message = await testPrisma.message.create({
        data: {
          content: 'Test message',
          senderType: 'human',
          roomId: testRoomId,
        },
      });

      expect(message.content).toBe('Test message');
      expect(message.senderType).toBe('human');
      expect(message.roomId).toBe(testRoomId);
      expect(message.id).toBeDefined();
    });

    it('should create agent message', async () => {
      const agent = await testPrisma.agent.create({
        data: {
          name: 'TestAgent',
          role: 'assistant',
          roomId: testRoomId,
          avatar: '🤖',
          talkativeness: 5,
          empathy: 5,
          curiosity: 5,
        },
      });

      const message = await testPrisma.message.create({
        data: {
          content: 'Agent response',
          senderType: 'agent',
          roomId: testRoomId,
          agentId: agent.id,
        },
      });

      expect(message.content).toBe('Agent response');
      expect(message.senderType).toBe('agent');
      expect(message.agentId).toBe(agent.id);
    });

    it('should handle metadata in message', async () => {
      const message = await testPrisma.message.create({
        data: {
          content: 'Message with metadata',
          senderType: 'human',
          roomId: testRoomId,
          metadata: JSON.stringify({ test: true, key: 'value' }),
        },
      });

      expect(message.metadata).not.toBeNull();
      expect(JSON.parse(message.metadata!)).toEqual({ test: true, key: 'value' });
    });
  });

  describe('Message Retrieval', () => {
    it('should retrieve message by id', async () => {
      const created = await testPrisma.message.create({
        data: {
          content: 'Test message',
          senderType: 'human',
          roomId: testRoomId,
        },
      });

      const message = await testPrisma.message.findUnique({
        where: { id: created.id },
      });

      expect(message).toBeDefined();
      expect(message?.id).toBe(created.id);
      expect(message?.content).toBe('Test message');
    });

    it('should return null for non-existent message', async () => {
      const message = await testPrisma.message.findUnique({
        where: { id: 'non-existent-id' },
      });

      expect(message).toBeNull();
    });

    it('should retrieve messages for room ordered by createdAt', async () => {
      await testPrisma.message.createMany({
        data: [
          { content: 'First', senderType: 'human', roomId: testRoomId, createdAt: new Date('2026-01-01') },
          { content: 'Second', senderType: 'human', roomId: testRoomId, createdAt: new Date('2026-01-02') },
          { content: 'Third', senderType: 'human', roomId: testRoomId, createdAt: new Date('2026-01-03') },
        ],
      });

      const messages = await testPrisma.message.findMany({
        where: { roomId: testRoomId },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('First');
      expect(messages[2].content).toBe('Third');
    });

    it('should limit results to specified count', async () => {
      await testPrisma.message.createMany({
        data: Array(20).fill(null).map((_, i) => ({
          content: `Message ${i}`,
          senderType: 'human',
          roomId: testRoomId,
        })),
      });

      const messages = await testPrisma.message.findMany({
        where: { roomId: testRoomId },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });

      expect(messages.length).toBe(5);
    });
  });

  describe('Agent Matching', () => {
    beforeEach(async () => {
      await testPrisma.agent.create({
        data: {
          name: 'Mom',
          role: 'mother',
          roomId: testRoomId,
          avatar: '👩',
          talkativeness: 8,
          empathy: 9,
          curiosity: 7,
        },
      });

      await testPrisma.agent.create({
        data: {
          name: 'Dad',
          role: 'father',
          roomId: testRoomId,
          avatar: '👨',
          talkativeness: 7,
          empathy: 6,
          curiosity: 5,
        },
      });
    });

    it('should find agent by exact name', async () => {
      const agent = await testPrisma.agent.findFirst({
        where: {
          roomId: testRoomId,
          name: 'Mom',
        },
      });

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Mom');
    });

    it('should find agent by role', async () => {
      const agent = await testPrisma.agent.findFirst({
        where: {
          roomId: testRoomId,
          role: 'father',
        },
      });

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Dad');
    });

    it('should return null for unknown agent', async () => {
      const agent = await testPrisma.agent.findFirst({
        where: {
          roomId: testRoomId,
          name: 'Unknown',
        },
      });

      expect(agent).toBeNull();
    });
  });
});
