# Milestone 4 Phase 1: Test Infrastructure - Technical Design

**Date**: 2026-04-02  
**Phase**: Milestone 4, Phase 1 (Infrastructure Setup)  
**Priority**: Must-Have (Critical Blocker)  
**Estimated Effort**: 9 hours  
**Timeline**: 2026-04-03 to 2026-04-04 (2 days)

---

## Executive Summary

This document provides the technical design for setting up comprehensive test infrastructure for Agent Hub. Phase 1 establishes the foundation for all subsequent testing work (Phases 2-5).

**Goal**: Create robust, scalable test infrastructure that supports:

- Unit tests (Jest + TypeScript)
- Integration tests (Supertest + in-memory DB)
- E2E tests (Playwright)
- Coverage enforcement (85% target)
- CI/CD integration

---

## Current State Analysis

### Test Coverage (As of 2026-04-02)

| Component       | Target | Current          | Gap  |
| --------------- | ------ | ---------------- | ---- |
| **Overall**     | 85%    | <5%              | -80% |
| **Unit Tests**  | 70%    | ~0%              | -70% |
| **Integration** | 20%    | ~0%              | -20% |
| **E2E Tests**   | 10%    | 1 file (failing) | -9%  |
| **Services**    | 100%   | 8% (1/12)        | -92% |

### Existing Test Files

```
tests/
├── e2e/
│   └── web-ui.spec.ts (14 tests, passing) ✅
│   └── discussion.spec.ts (needs fixing)
└── README.md
```

### Current Test Commands (package.json)

```json
{
  "scripts": {
    "test": "playwright test",
    "test:coverage": "playwright test --coverage",
    "test:ci": "playwright test --ci"
  }
}
```

**Issue**: Only E2E tests configured. No unit/integration test setup.

---

## Technical Architecture

### Test Pyramid Implementation

```
        /\
       /  \
      / E2E \      10% (15-20 tests)
     /--------\    Playwright, Cypress
    /          \
   / Integration \  20% (30-40 tests)
  /--------------\  Supertest, in-memory DB
 /                \
/    Unit Tests    \ 70% (50-70 tests)
-------------------- Jest, TypeScript
```

### Technology Stack

| Layer           | Tool                | Purpose                           | Why                                         |
| --------------- | ------------------- | --------------------------------- | ------------------------------------------- |
| **Unit Tests**  | Jest + ts-jest      | Test individual functions/classes | Industry standard, fast, TypeScript support |
| **Integration** | Supertest + Jest    | Test API endpoints                | Express-compatible, easy mocking            |
| **E2E Tests**   | Playwright          | Test full user flows              | Already in use, cross-browser               |
| **Coverage**    | Istanbul (via Jest) | Measure code coverage             | Accurate, detailed reports                  |
| **Mocking**     | Jest mocks + MSW    | Mock external services            | Built-in, powerful                          |
| **Test Data**   | Factory libraries   | Generate test data                | Consistent, maintainable                    |

---

## Infrastructure Setup

### 1. Directory Structure

```
agent-hub/
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── MessageService.ts
│   │   │   └── __tests__/        ← NEW: Unit tests
│   │   │       ├── MessageService.test.ts
│   │   │       └── ...
│   │   ├── routes/
│   │   │   ├── messages.ts
│   │   │   └── __tests__/        ← NEW: Integration tests
│   │   │       ├── messages.test.ts
│   │   │       └── ...
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── __tests__/
│   │   │       └── auth.test.ts
│   │   └── utils/
│   │       ├── error-handler.ts
│   │       └── __tests__/
│   │           └── error-handler.test.ts
│   └── jest.config.js            ← NEW: Jest configuration
├── tests/
│   ├── e2e/                      ← Existing E2E tests
│   │   ├── web-ui.spec.ts
│   │   └── discussion.spec.ts
│   ├── fixtures/                 ← NEW: Test data
│   │   ├── agents.ts
│   │   ├── rooms.ts
│   │   └── messages.ts
│   └── factories/                ← NEW: Data factories
│       ├── agent.factory.ts
│       ├── room.factory.ts
│       └── message.factory.ts
├── prisma/
│   └── test.db                   ← NEW: Test database
└── package.json                  ← Updated scripts
```

### 2. Jest Configuration

**File**: `server/jest.config.js`

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['**/server/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.d.ts',
    '!server/src/**/__tests__/**',
    '!server/src/lib/prisma.ts', // Exclude Prisma client
    '!server/src/index.ts', // Exclude entry point
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage/unit',
  setupFilesAfterEnv: ['<rootDir>/server/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'server/tsconfig.json',
      },
    ],
  },
};
```

### 3. Test Database Setup

**File**: `prisma/test.schema.prisma`

```prisma
// Separate schema for test database
datasource db {
  provider = "sqlite"
  url      = "file:./test.db"
}

generator client {
  provider = "prisma-client-js"
}

// Same models as production schema
model Room {
  id             String    @id @default(uuid())
  name           String
  externalChatId String?   @unique
  // ... rest of models
}
```

**Setup Script**: `scripts/setup-test-db.ts`

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(__dirname, '../prisma/test.db');

// Remove existing test database
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Run migrations on test database
execSync('npx prisma migrate dev --schema prisma/test.schema.prisma', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
});

console.log('✅ Test database created successfully');
```

### 4. Test Utilities

**File**: `server/src/test/setup.ts`

```typescript
/**
 * Global test setup
 * Runs before all test suites
 */

import { PrismaClient } from '@prisma/client';

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('Prisma')) return; // Silence Prisma warnings
  originalConsoleError(...args);
};

// Global Prisma client for tests
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/test.db',
    },
  },
});

// Cleanup after each test
afterEach(async () => {
  // Clean up database between tests
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
```

### 5. Test Factories

**File**: `tests/factories/agent.factory.ts`

```typescript
import { Prisma } from '@prisma/client';

/**
 * Agent Factory
 * Creates consistent test data with overrides
 */

const defaultAgent = {
  name: 'Test Agent',
  role: 'father',
  avatar: '👨',
  talkativeness: 50,
  empathy: 50,
  curiosity: 50,
  description: 'Test agent for unit tests',
};

export function createAgent(overrides: Partial<Prisma.AgentCreateInput> = {}) {
  return {
    ...defaultAgent,
    ...overrides,
  };
}

export function createMomAgent() {
  return createAgent({
    name: 'Mom',
    role: 'mother',
    avatar: '👩',
    talkativeness: 60,
    empathy: 80,
    curiosity: 60,
  });
}

export function createDadAgent() {
  return createAgent({
    name: 'Dad',
    role: 'father',
    avatar: '👨',
    talkativeness: 70,
    empathy: 60,
    curiosity: 50,
  });
}
```

**File**: `tests/factories/message.factory.ts`

```typescript
import { Prisma } from '@prisma/client';

const defaultMessage = {
  content: 'Test message',
  senderType: 'human' as const,
  metadata: JSON.stringify({ test: true }),
};

export function createMessage(roomId: string, overrides: Partial<Prisma.MessageCreateInput> = {}) {
  return {
    ...defaultMessage,
    room: { connect: { id: roomId } },
    ...overrides,
  };
}

export function createAgentMessage(
  roomId: string,
  agentId: string,
  content: string = 'Agent response'
) {
  return createMessage(roomId, {
    content,
    senderType: 'agent',
    agent: { connect: { id: agentId } },
  });
}
```

---

## Implementation Plan

### Phase 1 Tasks (9 hours total)

#### Task 1: Install Dependencies (30 min)

```bash
cd /home/jlguo/agent-hub

# Unit & Integration testing
npm install -D jest @types/jest ts-jest supertest @types/supertest

# Test utilities
npm install -D @faker-js/faker @types/faker

# Coverage reporting
npm install -D istanbul
```

#### Task 2: Create Jest Configuration (1 hour)

- [ ] Create `server/jest.config.js`
- [ ] Create `server/src/test/setup.ts`
- [ ] Create `prisma/test.schema.prisma`
- [ ] Create `scripts/setup-test-db.ts`
- [ ] Update `package.json` with test scripts

#### Task 3: Create Test Factories (2 hours)

- [ ] Create `tests/factories/agent.factory.ts`
- [ ] Create `tests/factories/room.factory.ts`
- [ ] Create `tests/factories/message.factory.ts`
- [ ] Create `tests/factories/discussion.factory.ts`
- [ ] Create `tests/fixtures/index.ts` (export all)

#### Task 4: Setup Test Database (1 hour)

- [ ] Run `scripts/setup-test-db.ts`
- [ ] Verify test database created
- [ ] Test Prisma client connection
- [ ] Document database reset procedure

#### Task 5: Create Example Tests (3 hours)

- [ ] Unit test: `MessageService.test.ts` (10 tests)
- [ ] Unit test: `HeatTracker.test.ts` (10 tests)
- [ ] Unit test: `error-handler.test.ts` (8 tests)
- [ ] Integration test: `messages.test.ts` (10 tests)
- [ ] Integration test: `rooms.test.ts` (8 tests)

#### Task 6: Update Package Scripts (30 min)

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "jest --config server/jest.config.js",
    "test:integration": "jest --config server/jest.config.integration.js",
    "test:e2e": "playwright test",
    "test:coverage": "npm run test:unit -- --coverage && npm run test:integration -- --coverage",
    "test:coverage:check": "npm run test:coverage -- --coverageThreshold='{\"global\":{\"branches\":70,\"functions\":80,\"lines\":80,\"statements\":80}}'",
    "test:ci": "npm run test:coverage:check -- --ci --maxWorkers=2",
    "test:watch": "npm run test:unit -- --watch",
    "test:setup-db": "tsx scripts/setup-test-db.ts"
  }
}
```

#### Task 7: Documentation (1.5 hours)

- [ ] Create `tests/README.md` with setup instructions
- [ ] Document test writing conventions
- [ ] Document factory usage
- [ ] Document debugging tips
- [ ] Add examples to `docs/TEST-QUALITY-REVIEW-2026-04-02.md`

---

## Acceptance Criteria

### Must-Have (Phase 1 Complete)

- [ ] All dependencies installed
- [ ] Jest configuration working
- [ ] Test database setup script functional
- [ ] At least 5 test factories created
- [ ] 40+ unit tests written (MessageService, HeatTracker, error-handler, etc.)
- [ ] 20+ integration tests written (API endpoints)
- [ ] Test coverage >40% (baseline for Phase 2)
- [ ] All tests pass (`npm test`)
- [ ] Coverage report generated
- [ ] Documentation complete

### Quality Gates

- [ ] No test takes >100ms (unit) or >500ms (integration)
- [ ] Tests are isolated (no cross-test dependencies)
- [ ] Tests use factories (no hardcoded data)
- [ ] External services mocked (OpenClaw, Feishu)
- [ ] CI/CD ready (can run with `npm run test:ci`)

---

## Dependencies & Risks

### Dependencies

| Dependency  | Status        | Owner  |
| ----------- | ------------- | ------ |
| Node.js 18+ | ✅ Installed  | DevOps |
| TypeScript  | ✅ Configured | Dev    |
| Prisma      | ✅ Configured | Dev    |
| Playwright  | ✅ Installed  | QA     |

### Risks

| Risk                                      | Impact | Probability | Mitigation                       |
| ----------------------------------------- | ------ | ----------- | -------------------------------- |
| Test database conflicts with dev DB       | Medium | Low         | Use separate file path           |
| Jest config conflicts with existing setup | Low    | Medium      | Test in isolation first          |
| Mocking Prisma is complex                 | Medium | High        | Use real test DB instead         |
| Tests run too slow                        | High   | Medium      | Parallel execution, limit DB ops |

---

## Testing Strategy

### Unit Tests

**What to Test**:

- Service methods (MessageService, HeatTracker, AgentSelector)
- Utility functions (error-handler, scoring)
- Pure functions (no external dependencies)

**What NOT to Test**:

- Prisma queries (use integration tests)
- WebSocket connections (use integration tests)
- External API calls (mock these)

**Example**:

```typescript
// MessageService.test.ts
describe('MessageService', () => {
  describe('parseMentions', () => {
    it('should extract @mentions from message', () => {
      const message = 'Hey @Mom @Dad, dinner?';
      const mentions = parseMentions(message);
      expect(mentions).toEqual(['mom', 'dad']);
    });

    it('should handle no mentions', () => {
      const message = 'Just a regular message';
      const mentions = parseMentions(message);
      expect(mentions).toEqual([]);
    });
  });
});
```

### Integration Tests

**What to Test**:

- API endpoints (GET /api/rooms, POST /api/messages)
- Database operations
- WebSocket events

**Example**:

```typescript
// messages.test.ts
describe('POST /api/messages/rooms/:roomId', () => {
  it('should create message and return 201', async () => {
    const room = await testPrisma.room.create({ data: { name: 'Test Room' } });

    const response = await request(app)
      .post(`/api/messages/rooms/${room.id}`)
      .send({ content: 'Test message', senderType: 'human' });

    expect(response.status).toBe(201);
    expect(response.body.content).toBe('Test message');
  });
});
```

---

## Success Metrics

| Metric             | Target    | Measurement              |
| ------------------ | --------- | ------------------------ |
| **Test Count**     | 60+ tests | Jest + Playwright output |
| **Coverage**       | >40%      | Istanbul report          |
| **Execution Time** | <2 min    | CI pipeline timing       |
| **Pass Rate**      | 100%      | All tests green          |
| **Flaky Tests**    | 0         | CI stability             |

---

## Next Steps (After Phase 1)

**Phase 2**: Write 50+ unit tests (Services, Utilities, Middleware)  
**Phase 3**: Write 30+ integration tests (All API endpoints)  
**Phase 4**: Fix and expand E2E tests (15+ critical flows)  
**Phase 5**: CI/CD enforcement (pre-commit hooks, coverage gates)

---

## Appendix

### A. Quick Start Commands

```bash
# Setup test database
npm run test:setup-db

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Check coverage threshold
npm run test:coverage:check
```

### B. Troubleshooting

**Problem**: Tests fail with "database locked"  
**Solution**: Run `rm prisma/test.db` and re-run setup script

**Problem**: Jest can't find TypeScript files  
**Solution**: Check `jest.config.js` rootDir and testMatch patterns

**Problem**: Coverage threshold fails  
**Solution**: Run `npm run test:coverage` to see detailed report

---

**Document Status**: ✅ Complete  
**Ready for Implementation**: Yes  
**Estimated Effort**: 9 hours  
**Priority**: Must-Have (Blocks Milestone 3 Phase 2+)
