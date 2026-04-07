/**
 * Global test setup
 * Runs before all test suites
 */

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('Prisma')) return;
  originalConsoleError(...args);
};

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
      timestamp: new Date().toISOString(),
    }),
    healthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      mode: 'cli',
    }),
  })),
}));
