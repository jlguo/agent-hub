/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/lib/prisma.ts',
    '!src/index.ts',
  ],
  // Gradual coverage thresholds (Phase 3)
  // Week 1: 20%, Week 2: 40%, Week 3: 60%, Week 4: 80%
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 25,
      statements: 25,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage/unit',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.\\.?/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
        isolatedModules: true, // Bypass strict type checking for Prisma XOR types
      },
    ],
  },
  // Run tests in sequence to avoid database conflicts
  // Use ts-jest with transpileOnly to bypass Prisma XOR type issues in tests
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        skipLibCheck: true,
        noImplicitAny: false,
      },
    },
  },
  maxWorkers: 1,
  // ES module support
  extensionsToTreatAsEsm: ['.ts'],
  // Test result reporting
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Agent Hub Unit Tests',
        outputPath: 'coverage/unit/test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
  ],
};
