/**
 * Global test setup
 * Runs before all test suites
 */

import { PrismaClient } from '@prisma/client';

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('Prisma')) return;
  originalConsoleError(...args);
};

// Global Prisma client for tests
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../prisma/test.db',
    },
  },
});

// Cleanup after each test
afterEach(async () => {
  await testPrisma.message.deleteMany();
  await testPrisma.discussion.deleteMany();
  await testPrisma.relationship.deleteMany();
  await testPrisma.agent.deleteMany();
  await testPrisma.room.deleteMany();
});

// Close connection after all tests
afterAll(async () => {
  await testPrisma.$disconnect();
});

// Mock Socket.IO
jest.mock('../lib/socket', () => ({
  getIO: () => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));

// Mock OpenClaw Service
jest.mock('../services/OpenClawService', () => ({
  OpenClawService: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({
      content: 'Mock response',
    }),
  })),
}));
