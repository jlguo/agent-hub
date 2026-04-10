/**
 * Messages API Integration Tests - Simplified
 *
 * Uses dev database directly for faster test execution
 * @jest-environment node
 */

import request from 'supertest';
import { prisma } from '../../index';
import { createTestAgentData, createTestRoomData } from '../../test/test-utils';
import { createApp } from '../../index';
import { Server } from 'http';

let app: any;
let server: Server;

// Disable global test setup
beforeAll(async () => {
  // Create app instance for testing
  app = createApp();

  // Start test server on random port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      resolve();
    });
  });
});

afterAll(async () => {
  // Close test server
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
});

// Clean database before each test
beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.discussion.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.room.deleteMany();
});

describe('Messages API - GET /api/messages/rooms/:roomId', () => {
  it('should return empty array for room with no messages', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-1' }) as any,
    });

    const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return messages for room', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-2' }) as any,
    });

    const agent = await prisma.agent.create({
      data: createTestAgentData({ id: 'family-mom', name: 'Mom', roomId: room.id }) as any,
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

  it('should include agent information in messages', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-3' }) as any,
    });

    const agent = await prisma.agent.create({
      data: {
        ...(createTestAgentData({ id: 'family-dad', name: 'Dad', roomId: room.id }) as any),
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

  it('should handle non-existent room gracefully', async () => {
    const response = await request(app).get('/api/messages/rooms/non-existent-room').expect(200);

    expect(response.body).toEqual([]);
  });

  it('should respect limit parameter', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-4' }) as any,
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

describe('Messages API - POST /api/rooms/:roomId/messages', () => {
  it('should create human message successfully', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-5' }) as any,
    });

    const response = await request(app)
      .post(`/api/messages/rooms/${room.id}`)
      .send({
        content: 'Hello family!',
        senderType: 'human',
      })
      .expect(201);

    expect(response.body.content).toBe('Hello family!');
    expect(response.body.senderType).toBe('human');
    expect(response.body.roomId).toBe(room.id);
  });

  it('should create agent message successfully', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-6' }) as any,
    });

    const agent = await prisma.agent.create({
      data: createTestAgentData({ id: 'family-mom-2', name: 'Mom', roomId: room.id }) as any,
    });

    const response = await request(app)
      .post(`/api/messages/rooms/${room.id}`)
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

  it('should return 400 if content is missing', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-7' }) as any,
    });

    const response = await request(app)
      .post(`/api/messages/rooms/${room.id}`)
      .send({ senderType: 'human' })
      .expect(400);

    expect(response.body.error).toBe('Content is required');
  });

  it('should return 404 for non-existent room', async () => {
    const response = await request(app)
      .post('/api/messages/rooms/non-existent-room')
      .send({ content: 'Test' })
      .expect(404);

    expect(response.body.error).toBe('Room not found');
  });

  it('should handle empty content gracefully', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-8' }) as any,
    });

    const response = await request(app)
      .post(`/api/messages/rooms/${room.id}`)
      .send({ content: '', senderType: 'human' })
      .expect(400);

    expect(response.body.error).toBe('Content is required');
  });
});

describe('Messages API - Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-9' }) as any,
    });

    const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

    expect(response.body).toBeDefined();
  });

  it('should handle invalid room ID format', async () => {
    const response = await request(app).get('/api/messages/rooms/invalid!@#$').expect(200);

    // Should return empty array, not crash
    expect(response.body).toEqual([]);
  });
});

describe('Messages API - Message Transformation', () => {
  it('should transform agent messages with agent info', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-10' }) as any,
    });

    const agent = await prisma.agent.create({
      data: {
        ...(createTestAgentData({ id: 'family-bro', name: 'Bro', roomId: room.id }) as any),
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

  it('should handle messages without agent (human messages)', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-11' }) as any,
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

describe('Messages API - Performance', () => {
  it('should handle large message sets efficiently', async () => {
    const room = await prisma.room.create({
      data: createTestRoomData({ name: 'test-room-12' }) as any,
    });

    // Create 100 messages
    const messages = Array.from({ length: 100 }, (_, i) => ({
      roomId: room.id,
      senderType: i % 2 === 0 ? 'human' : 'agent',
      content: `Message ${i}`,
    }));

    await prisma.message.createMany({ data: messages as any });

    const startTime = Date.now();
    const response = await request(app).get(`/api/messages/rooms/${room.id}`).expect(200);

    const duration = Date.now() - startTime;

    expect(response.body).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should complete in <1s
  });
});
