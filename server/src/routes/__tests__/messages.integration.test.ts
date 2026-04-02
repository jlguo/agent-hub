/**
 * Messages API Integration Tests
 * Tests HTTP endpoints for message operations
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../../index';

const prisma = new PrismaClient();

// Test data
let testRoomId: string;

beforeAll(async () => {
  // Create test room
  const testRoom = await prisma.room.create({
    data: {
      name: 'Integration Test Room',
      externalChatId: `test-${Date.now()}`,
    },
  });
  testRoomId = testRoom.id;
});

afterAll(async () => {
  try {
    await prisma.message.deleteMany({ where: { roomId: testRoomId } });
    await prisma.room.delete({ where: { id: testRoomId } });
  } catch (e) {
    // Ignore cleanup errors
  } finally {
    await prisma.$disconnect();
  }
});

describe('Messages API - Integration Tests', () => {
  const baseUrl = '/api/messages/rooms';

  describe('GET /api/messages/rooms/:roomId', () => {
    it('should return 200 and empty array for room with no messages', async () => {
      const response = await request(app)
        .get(`${baseUrl}/${testRoomId}`)
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return messages for room with messages', async () => {
      const testMessage = await prisma.message.create({
        data: {
          content: 'Test message',
          senderType: 'human',
          roomId: testRoomId,
        },
      });

      const response = await request(app)
        .get(`${baseUrl}/${testRoomId}`)
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      await prisma.message.delete({ where: { id: testMessage.id } });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get(`${baseUrl}/${testRoomId}?limit=5`)
        .expect(200);
      
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/messages/rooms/:roomId', () => {
    it('should create message and return 201', async () => {
      const response = await request(app)
        .post(`${baseUrl}/${testRoomId}`)
        .send({
          content: 'New test message',
          senderType: 'human',
        })
        .expect(201);
      
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe('New test message');
      
      await prisma.message.delete({ where: { id: response.body.id } });
    });

    it('should return 400 for empty content', async () => {
      await request(app)
        .post(`${baseUrl}/${testRoomId}`)
        .send({ content: '', senderType: 'human' })
        .expect(400);
    });

    it('should return 400 for missing content', async () => {
      await request(app)
        .post(`${baseUrl}/${testRoomId}`)
        .send({ senderType: 'human' })
        .expect(400);
    });

    it('should return 404 for non-existent room', async () => {
      await request(app)
        .post(`${baseUrl}/non-existent-room`)
        .send({ content: 'Test', senderType: 'human' })
        .expect(404);
    });
  });
});
