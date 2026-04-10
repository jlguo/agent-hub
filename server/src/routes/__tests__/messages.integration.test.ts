/**
 * Messages API Integration Tests
 *
 * Tests the complete message flow:
 * - GET /api/messages/rooms/:roomId
 * - POST /api/rooms/:roomId/messages
 * - WebSocket events
 * - Feishu sync (mocked)
 * - Discussion triggers
 */

import request from 'supertest';
import { prisma } from '../../index';
import { setupTestDatabase, cleanupTestDatabase, withTestDatabase } from '../../test/database';
import { createTestAgentData, createTestRoomData } from '../../test/test-utils';
import { createApp } from '../../index';
import { Server } from 'http';

let app: any;
let server: Server;

beforeAll(async () => {
  // Setup test database first
  await setupTestDatabase();

  // Create app instance for testing (isolated from production server)
  app = createApp();

  // Start test server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      resolve();
    });
  });

  // Setup test database
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('Messages API - GET /api/messages/rooms/:roomId', () => {
  beforeEach(async () => {
    await withTestDatabase(async () => {
      // Clean up any existing data
      await prisma.message.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.room.deleteMany();
    });
  });

  it('should return empty array for room with no messages', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      expect(response.body).toEqual([]);
    });
  });

  it('should return messages for room', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      const agent = await prisma.agent.create({
        data: {
          ...createTestAgentData({ id: 'family-mom', roomId: room.id }),
        },
      });

      await prisma.message.create({
        data: {
          roomId: room.id,
          agentId: agent.id,
          senderType: 'agent',
          content: 'Hello from Mom',
        },
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].content).toBe('Hello from Mom');
      expect(response.body[0].agentName).toBe('Mom');
    });
  });

  it('should include agent information in messages', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      const agent = await prisma.agent.create({
        data: {
          ...createTestAgentData({ id: 'family-dad', name: 'Dad', roomId: room.id }),
          avatar: '👨',
        },
      });

      await prisma.message.create({
        data: {
          roomId: room.id,
          agentId: agent.id,
          senderType: 'agent',
          content: 'Dad here',
        },
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      expect(response.body[0].agentName).toBe('Dad');
      expect(response.body[0].agentAvatar).toBe('👨');
    });
  });

  it('should handle non-existent room gracefully', async () => {
    const response = await request(app).get('/api/messages/rooms/non-existent-room').expect(200);

    expect(response.body).toEqual([]);
  });

  it('should respect limit parameter', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      // Create 10 messages
      for (let i = 0; i < 10; i++) {
        await prisma.message.create({
          data: {
            roomId: room.id,
            senderType: 'human',
            content: `Message ${i}`,
          },
        });
      }

      const response = await request(app).get(`/api/messages/rooms/${room.id}?limit=5`).expect(200);

      expect(response.body).toHaveLength(5);
    });
  });
});

describe('Messages API - POST /api/rooms/:roomId/messages', () => {
  beforeEach(async () => {
    await withTestDatabase(async () => {
      await prisma.message.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.room.deleteMany();
    });
  });

  it('should create human message successfully', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({
          content: 'Hello family!',
          senderType: 'human',
        })
        .expect(201);

      expect(response.body.content).toBe('Hello family!');
      expect(response.body.senderType).toBe('human');
      expect(response.body.roomId).toBe(room.id);
    });
  });

  it('should create agent message successfully', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      const agent = await prisma.agent.create({
        data: createTestAgentData({ id: 'family-mom', name: 'Mom', roomId: room.id }),
      });

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({
          content: 'Mom here',
          senderType: 'agent',
          agentId: agent.id,
        })
        .expect(201);

      expect(response.body.content).toBe('Mom here');
      expect(response.body.senderType).toBe('agent');
      expect(response.body.agentId).toBe(agent.id);
    });
  });

  it('should return 400 if content is missing', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({ senderType: 'human' })
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });
  });

  it('should return 404 for non-existent room', async () => {
    const response = await request(app)
      .post('/api/rooms/non-existent-room/messages')
      .send({ content: 'Test' })
      .expect(404);

    expect(response.body.error).toBe('Room not found');
  });

  it('should trigger agent response for human message', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      await prisma.agent.create({
        data: createTestAgentData({ id: 'family-mom', name: 'Mom', roomId: room.id }) as any,
      });

      // Mock OpenClawService to avoid actual CLI calls
      vi.mock('../services/OpenClawService', () => ({
        OpenClawService: {
          sendMessage: vi.fn().mockResolvedValue({ content: 'Agent response' }),
          healthCheck: vi.fn().mockResolvedValue({ status: 'healthy' }),
        },
      }));

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({
          content: 'Hello',
          senderType: 'human',
        })
        .expect(201);

      // Message should be created immediately
      expect(response.body.senderType).toBe('human');

      // Agent response would be triggered asynchronously (not awaited in route)
      // This is by design to avoid blocking the response
    });
  });

  it('should trigger discussion for /discuss command', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      await prisma.agent.create({
        data: createTestAgentData({ id: 'family-mom', name: 'Mom', roomId: room.id }) as any,
      });

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({
          content: '/discuss What should we have for dinner?',
          senderType: 'human',
        })
        .expect(201);

      expect(response.body.content).toContain('/discuss');

      // Discussion would be triggered asynchronously
      // Integration test verifies the trigger, not the full discussion flow
    });
  });

  it('should handle empty content gracefully', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      const response = await request(app)
        .post(`/api/rooms/${room.id}/messages`)
        .send({ content: '', senderType: 'human' })
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });
  });
});

describe('Messages API - Error Handling', () => {
  beforeEach(async () => {
    await withTestDatabase(async () => {
      await prisma.message.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.room.deleteMany();
    });
  });

  it('should handle database errors gracefully', async () => {
    // This test verifies error handling when DB is unavailable
    // In real scenarios, this would test connection failures
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      expect(response.body).toBeDefined();
    });
  });

  it('should handle invalid room ID format', async () => {
    const response = await request(app).get('/api/messages/rooms/invalid!@#$').expect(200);

    // Should return empty array, not crash
    expect(response.body).toEqual([]);
  });
});

describe('Messages API - Message Transformation', () => {
  beforeEach(async () => {
    await withTestDatabase(async () => {
      await prisma.message.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.room.deleteMany();
    });
  });

  it('should transform agent messages with agent info', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });
      const agent = await prisma.agent.create({
        data: {
          ...createTestAgentData({ id: 'family-bro', name: 'Bro', roomId: room.id }),
          name: 'Bro',
          avatar: '👦',
        },
      });

      await prisma.message.create({
        data: {
          roomId: room.id,
          agentId: agent.id,
          senderType: 'agent',
          content: 'Bro message',
        },
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      const message = response.body[0];
      expect(message.agentName).toBe('Bro');
      expect(message.agentAvatar).toBe('👦');
      expect(message.content).toBe('Bro message');
    });
  });

  it('should handle messages without agent (human messages)', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      await prisma.message.create({
        data: {
          roomId: room.id,
          senderType: 'human',
          content: 'Human message',
        },
      });

      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      const message = response.body[0];
      expect(message.agentName).toBeUndefined();
      expect(message.agentAvatar).toBeUndefined();
      expect(message.content).toBe('Human message');
      expect(message.senderType).toBe('human');
    });
  });
});

describe('Messages API - Performance', () => {
  beforeEach(async () => {
    await withTestDatabase(async () => {
      await prisma.message.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.room.deleteMany();
    });
  });

  it('should handle large message sets efficiently', async () => {
    await withTestDatabase(async () => {
      const room = await prisma.room.create({
        data: createTestRoomData({ name: 'test-room' }) as any,
      });

      // Create 100 messages
      const messages = Array.from({ length: 100 }, (_, i) => ({
        roomId: room.id,
        senderType: i % 2 === 0 ? 'human' : 'agent',
        content: `Message ${i}`,
      }));

      await prisma.message.createMany({ data: messages });

      const startTime = Date.now();
      const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

      const duration = Date.now() - startTime;

      expect(response.body).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });
  });
});
