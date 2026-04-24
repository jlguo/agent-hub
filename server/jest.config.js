/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
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
        isolatedModules: true,
      },
    ],
  },
  maxWorkers: 1,
  extensionsToTreatAsEsm: ['.ts'],
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
