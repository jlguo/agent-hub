/**
 * Global test setup
 * Runs before all test suites
 */

import { vi, afterAll, beforeAll } from 'vitest';
import path from 'path';

// Ensure NODE_ENV is set to test BEFORE any module imports
process.env.NODE_ENV = 'test';

// Mock SessionGuardian BEFORE index.ts imports it
vi.mock('../services/SessionGuardian', () => ({
  SessionGuardian: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

import { PrismaClient } from '@prisma/client';

// Resolve absolute test DB path (setup.ts is at server/src/test/setup.ts)
export const TEST_DB_ABSOLUTE = path.resolve(__dirname, '../../prisma/test.db');

// Override DATABASE_URL for test environment before any module reads it.
// The .env file may contain a Docker container path (file:/app/prisma/dev.db)
// which doesn't exist locally. This must run before index.ts creates its PrismaClient.
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('/app/')) {
  process.env.DATABASE_URL = `file:${TEST_DB_ABSOLUTE}`;
}

// Test Prisma client for tests that need database access
export const testPrisma = new PrismaClient({
  datasourceUrl: `file:${TEST_DB_ABSOLUTE}`,
});

// Cleanup database connections after all tests
afterAll(async () => {
  if (testPrisma) {
    await testPrisma.$disconnect();
  }
  // Clear all timers/intervals to prevent test hang
  vi.clearAllTimers();
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
