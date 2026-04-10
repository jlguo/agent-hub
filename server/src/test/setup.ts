/**
 * Global test setup
 * Runs before all test suites
 */

import { PrismaClient } from '@prisma/client';
import { vi, afterAll } from 'vitest';

// Test Prisma client for tests that need database access
export const testPrisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || 'file:../prisma/test.db',
});

// Cleanup database connections after all tests
afterAll(async () => {
  if (testPrisma) {
    await testPrisma.$disconnect();
  }
});

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('Prisma')) return;
  originalConsoleError(...args);
};

// Mock Socket.IO
vi.mock('../lib/socket', () => ({
  getIO: () => ({
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  }),
}));
