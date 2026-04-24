/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['**/server/src/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.d.ts',
    '!server/src/**/__tests__/**',
    '!server/src/lib/prisma.ts',
    '!server/src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage/integration',
  setupFilesAfterEnv: ['<rootDir>/server/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'server/tsconfig.json',
      useESM: true,
    }],
  },
  // Run tests in sequence to avoid database conflicts
  maxWorkers: 1,
  // Longer timeout for integration tests
  testTimeout: 30000,
  // ES module support
  extensionsToTreatAsEsm: ['.ts'],
};
