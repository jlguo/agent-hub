# Automated Testing Strategy for Agent Hub

**Comprehensive testing approach for production-ready deployment**

---

## Testing Pyramid

```
        ╱╲
       ╱  ╲
      ╱ E2E ╲         ← 10% of tests (critical flows)
     ╱────────╲
    ╱Integration╲     ← 20% of tests (API, DB, external)
   ╱──────────────╲
  ╱    Unit Tests    ╲  ← 70% of tests (fast, isolated)
 ╱────────────────────╲
```

---

## 1. Unit Tests (70% of Tests)

**What to Test**: Individual functions, services, utilities  
**Framework**: Jest (already configured)  
**Speed**: < 100ms per test  
**Location**: `*.test.ts` next to source files

### Priority Areas

#### A. Core Services (High Priority)

```typescript
// server/src/services/__tests__/MessageService.test.ts
describe('MessageService', () => {
  describe('selectAgentWithMention', () => {
    it('should select mentioned agent with 100% priority', async () => {
      const message = '@Mom what should we eat?';
      const agents = [
        { id: 'family-mom', name: 'Mom', role: 'mother' },
        { id: 'family-dad', name: 'Dad', role: 'father' },
      ];
      
      const result = await selectAgentWithMention(message, agents, roomId);
      
      expect(result.selectedAgents[0].name).toBe('Mom');
      expect(result.reason).toBe('@mention');
    });
    
    it('should skip agents on cooldown', async () => {
      // Test cooldown logic
    });
    
    it('should handle unknown @mentions with smart fallback', async () => {
      // Test fallback logic
    });
  });
  
  describe('handleFeishuMessage', () => {
    it('should save Feishu message to database', async () => {
      // Test DB persistence
    });
    
    it('should trigger agent response based on heat', async () => {
      // Test heat-based selection
    });
  });
});
```

```typescript
// server/src/services/__tests__/HeatTracker.test.ts
describe('HeatTracker', () => {
  describe('updateHeat', () => {
    it('should increase heat on user message', () => {
      const heat = heatTracker.updateHeat(discussionId, {
        messageType: 'human',
        isTopicMention: false,
      });
      
      expect(heat).toBeGreaterThan(previousHeat);
    });
    
    it('should apply decay every 30 seconds', () => {
      // Test decay cycle
    });
    
    it('should cap heat at 100', () => {
      // Test upper bound
    });
  });
  
  describe('calculateProbability', () => {
    it('should return 30% at COLD heat (0-20)', () => {
      expect(calculateProbability(15)).toBe(0.3);
    });
    
    it('should return 80% at HOT heat (70+)', () => {
      expect(calculateProbability(85)).toBe(0.8);
    });
  });
});
```

```typescript
// server/src/services/__tests__/OpenClawService.test.ts
describe('OpenClawService', () => {
  describe('HTTP Mode', () => {
    it('should call HTTP endpoint with token', async () => {
      process.env.OPENCLAW_MODE = 'http';
      process.env.OPENCLAW_VERIFICATION_TOKEN = 'test-token';
      
      const service = new OpenClawService();
      const response = await service.sendMessage('test', 'family-mom', 'test');
      
      expect(response.content).toBeDefined();
    });
    
    it('should fail without token in HTTP mode', () => {
      process.env.OPENCLAW_MODE = 'http';
      delete process.env.OPENCLAW_VERIFICATION_TOKEN;
      
      expect(() => new OpenClawService()).toThrow('OPENCLAW_VERIFICATION_TOKEN required');
    });
  });
  
  describe('CLI Mode', () => {
    it('should call CLI without token', async () => {
      process.env.OPENCLAW_MODE = 'cli';
      
      const service = new OpenClawService();
      const response = await service.sendMessage('test', 'family-mom', 'test');
      
      expect(response.content).toBeDefined();
    });
  });
});
```

#### B. Authentication Middleware (High Priority)

```typescript
// server/src/middleware/__tests__/auth.test.ts
describe('Authentication Middleware', () => {
  describe('verifyToken', () => {
    it('should accept valid Bearer token', () => {
      const req = { headers: { authorization: 'Bearer valid-token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      
      verifyToken(req as any, res as any, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should reject invalid token', () => {
      const req = { headers: { authorization: 'Bearer wrong-token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      
      verifyToken(req as any, res as any, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
    
    it('should reject missing Authorization header', () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      
      verifyToken(req as any, res as any, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
  
  describe('verifyApiKey', () => {
    it('should accept valid API key', () => {
      // Test API key auth
    });
  });
});
```

#### C. Utilities (Medium Priority)

```typescript
// server/src/utils/__tests__/scoring.test.ts
describe('Scoring Utilities', () => {
  describe('calculateAgentScore', () => {
    it('should weight topic relevance at 30%', () => {
      // Test scoring algorithm
    });
    
    it('should apply cooldown penalty', () => {
      // Test cooldown impact
    });
    
    it('should add random variance for tiebreaking', () => {
      // Test randomness
    });
  });
});
```

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- MessageService.test.ts

# Run in watch mode (TDD)
npm run test:watch
```

---

## 2. Integration Tests (20% of Tests)

**What to Test**: API endpoints, database operations, external services  
**Framework**: Jest + Supertest  
**Speed**: < 1s per test  
**Location**: `tests/integration/`

### Priority Areas

#### A. API Endpoints

```typescript
// tests/integration/api/messages.test.ts
import request from 'supertest';
import { app } from '../../src/index';

describe('Messages API', () => {
  describe('POST /api/messages/rooms/:roomId', () => {
    it('should save message and return 201', async () => {
      const response = await request(app)
        .post('/api/messages/rooms/family-room-demo')
        .send({ content: 'Test message', senderType: 'human' })
        .expect(201);
      
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe('Test message');
    });
    
    it('should trigger agent response when heat is high', async () => {
      // Send multiple messages to build heat
      // Verify agent response is triggered
    });
    
    it('should reject empty messages', async () => {
      await request(app)
        .post('/api/messages/rooms/family-room-demo')
        .send({ content: '' })
        .expect(400);
    });
  });
  
  describe('GET /api/messages/rooms/:roomId', () => {
    it('should return messages in chronological order', async () => {
      const response = await request(app)
        .get('/api/messages/rooms/family-room-demo?limit=10')
        .expect(200);
      
      expect(response.body.length).toBeLessThanOrEqual(10);
      expect(response.body[0].createdAt).toBeLessThanOrEqual(
        response.body[1].createdAt
      );
    });
  });
});
```

#### B. OpenClaw Gateway Integration

```typescript
// tests/integration/openclaw-gateway.test.ts
describe('OpenClaw Gateway API', () => {
  describe('POST /api/openclaw/gateway', () => {
    it('should accept valid token and call OpenClaw', async () => {
      const response = await request(app)
        .post('/api/openclaw/gateway')
        .set('Authorization', 'Bearer test-token')
        .send({
          message: 'Hello',
          agent: 'family-mom',
          sessionId: 'test-session'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.content).toBeDefined();
    });
    
    it('should reject invalid token', async () => {
      await request(app)
        .post('/api/openclaw/gateway')
        .set('Authorization', 'Bearer wrong-token')
        .send({ message: 'Hello', agent: 'mom', sessionId: 'test' })
        .expect(403);
    });
    
    it('should reject missing authentication', async () => {
      await request(app)
        .post('/api/openclaw/gateway')
        .send({ message: 'Hello', agent: 'mom', sessionId: 'test' })
        .expect(401);
    });
    
    it('should accept API key as alternative auth', async () => {
      await request(app)
        .post('/api/openclaw/gateway')
        .set('X-API-Key', 'test-api-key')
        .send({ message: 'Hello', agent: 'mom', sessionId: 'test' })
        .expect(200);
    });
  });
  
  describe('GET /api/openclaw/gateway/health', () => {
    it('should return health status without auth', async () => {
      const response = await request(app)
        .get('/api/openclaw/gateway/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
      expect(response.body.mode).toBeDefined();
    });
  });
});
```

#### C. Database Operations

```typescript
// tests/integration/database/relationships.test.ts
describe('Database Relationships', () => {
  it('should load all relationships for an agent', async () => {
    const agent = await prisma.agent.findUnique({
      where: { id: 'family-mom' },
      include: {
        relationshipsAsA: true,
        relationshipsAsB: true,
      }
    });
    
    const allRelationships = [...agent.relationshipsAsA, ...agent.relationshipsAsB];
    expect(allRelationships.length).toBeGreaterThan(0);
  });
  
  it('should create bidirectional relationships', async () => {
    // Test relationship creation
  });
});
```

#### D. WebSocket Integration

```typescript
// tests/integration/websocket/messages.test.ts
import { io as ClientIO, Socket } from 'socket.io-client';

describe('WebSocket Messages', () => {
  let socket: Socket;
  
  beforeEach((done) => {
    socket = ClientIO('http://localhost:4000');
    socket.on('connect', done);
  });
  
  afterEach(() => {
    socket.disconnect();
  });
  
  it('should receive message:new event when message sent', (done) => {
    socket.on('message:new', (message) => {
      expect(message.content).toBe('Test WebSocket message');
      done();
    });
    
    socket.emit('message:send', {
      roomId: 'family-room-demo',
      content: 'Test WebSocket message'
    });
  });
  
  it('should join room and receive room-specific messages', (done) => {
    socket.emit('room:join', { roomId: 'family-room-demo' });
    
    socket.on('message:new', (message) => {
      expect(message.roomId).toBe('family-room-demo');
      done();
    });
  });
});
```

### Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with test database
TEST_DB=true npm run test:integration

# Run specific integration test
npm run test:integration -- openclaw-gateway.test.ts
```

---

## 3. E2E Tests (10% of Tests)

**What to Test**: Complete user flows, critical paths  
**Framework**: Playwright (already configured)  
**Speed**: 5-30s per test  
**Location**: `tests/e2e/`

### Priority Areas

#### A. Critical User Flows (P0)

```typescript
// tests/e2e/critical-flows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('User sends message and receives agent response', async ({ page }) => {
    // 1. Open Web UI
    await page.goto('http://localhost:3000');
    
    // 2. Wait for WebSocket connection
    await page.waitForSelector('.status-connected');
    
    // 3. Send message
    await page.fill('textarea[placeholder*="Type"]', 'Hello family!');
    await page.click('button:has-text("Send")');
    
    // 4. Wait for agent response (should appear within 30s)
    await page.waitForSelector('.message-agent', { timeout: 30000 });
    
    // 5. Verify response is from agent
    const agentMessage = await page.locator('.message-agent').last();
    await expect(agentMessage).toBeVisible();
  });
  
  test('@mention triggers specific agent response', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Send @mention message
    await page.fill('textarea', '@Mom what should we eat?');
    await page.click('button:has-text("Send")');
    
    // Wait for Mom's response specifically
    await page.waitForSelector('.message-agent:has-text("Mom")', { timeout: 30000 });
  });
  
  test('/discuss command triggers agent discussion', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Trigger discussion
    await page.fill('textarea', '/discuss what should we do this weekend?');
    await page.click('button:has-text("Send")');
    
    // Wait for discussion start banner
    await page.waitForSelector('.discussion-start', { timeout: 5000 });
    
    // Wait for multiple agent responses (4-8 turns)
    await page.waitForSelector('.discussion-turn:nth-child(4)', { timeout: 60000 });
    
    // Wait for discussion end banner
    await page.waitForSelector('.discussion-end', { timeout: 60000 });
  });
});
```

#### B. Feishu Integration (P0)

```typescript
// tests/e2e/feishu-integration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feishu Integration', () => {
  test('Feishu message appears in Web UI', async ({ page }) => {
    // This test requires Feishu webhook setup
    // Can be mocked or run against staging environment
    
    await page.goto('http://localhost:3000');
    
    // Simulate Feishu message via API
    await page.evaluate(async () => {
      await fetch('http://localhost:4000/api/webhooks/feishu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: { content: 'Test from Feishu', sender: { name: 'Dad' } }
        })
      });
    });
    
    // Verify message appears in UI
    await page.waitForSelector('.message:has-text("Test from Feishu")');
  });
  
  test('Web UI message syncs to Feishu', async ({ page }) => {
    // Requires Feishu API credentials
    // Can verify via webhook logs or mock
    
    await page.goto('http://localhost:3000');
    await page.fill('textarea', 'Sync test message');
    await page.click('button:has-text("Send")');
    
    // Verify Feishu API was called (check logs or mock)
    // This is typically tested via integration tests instead
  });
});
```

#### C. Agent Response Quality (P1)

```typescript
// tests/e2e/agent-responses.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Response Quality', () => {
  test('Mom responds with caring personality', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.fill('textarea', 'I am feeling sick today');
    await page.click('button:has-text("Send")');
    
    // Wait for response
    const response = await page.waitForSelector('.message-agent', { timeout: 30000 });
    const text = await response.textContent();
    
    // Verify caring language (simplified check)
    expect(text.toLowerCase()).toMatch(/care|feel|better|health/);
  });
  
  test('Agents use proper family terms', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    await page.fill('textarea', '@Grandpa tell me a story');
    await page.click('button:has-text("Send")');
    
    const response = await page.waitForSelector('.message-agent:has-text("Grandpa")', { timeout: 30000 });
    const text = await response.textContent();
    
    // Verify Grandpa uses appropriate terms
    expect(text).toMatch(/乖孙 | 宝贝 | 爷爷/);
  });
});
```

#### D. Error Handling (P1)

```typescript
// tests/e2e/error-handling.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('Handles OpenClaw timeout gracefully', async ({ page }) => {
    // This requires mocking OpenClaw to simulate timeout
    // Can be done via test fixtures or mock server
    
    await page.goto('http://localhost:3000');
    await page.fill('textarea', 'Trigger timeout test');
    await page.click('button:has-text("Send")');
    
    // Should show error message, not crash
    await page.waitForSelector('.error-message', { timeout: 65000 }); // After 60s timeout
  });
  
  test('Handles WebSocket disconnection', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Disconnect WebSocket
    await page.evaluate(() => {
      window.localStorage.setItem('mockWebSocketDown', 'true');
      location.reload();
    });
    
    // Should show reconnection UI
    await page.waitForSelector('.reconnecting-indicator');
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e -- critical-flows.spec.ts

# Run with specific browser
npm run test:e2e -- --project=chromium
```

---

## 4. Performance Tests (Optional)

**What to Test**: Load testing, stress testing  
**Framework**: k6 or Artillery  
**Location**: `tests/performance/`

### Example: Load Test

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  // Test message sending
  const payload = {
    content: 'Load test message',
    senderType: 'human',
  };
  
  const response = http.post(
    'http://localhost:4000/api/messages/rooms/family-room-demo',
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### Running Performance Tests

```bash
# Install k6
brew install k6  # macOS
# or download from k6.io

# Run load test
k6 run tests/performance/load-test.js

# Run with specific VUs
k6 run --vus 50 --duration 10m tests/performance/load-test.js
```

---

## 5. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_DB: true
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
```

---

## 6. Test Coverage Goals

| Component | Target Coverage | Current | Priority |
|-----------|----------------|---------|----------|
| **Services** | 90% | TBD | P0 |
| **Middleware** | 95% | TBD | P0 |
| **Routes** | 85% | TBD | P1 |
| **Utilities** | 80% | TBD | P2 |
| **Frontend Components** | 70% | TBD | P2 |
| **Overall** | 85% | TBD | P1 |

---

## 7. Testing Best Practices

### DO ✅

- Write tests before fixing bugs (regression tests)
- Mock external services (OpenClaw, Feishu)
- Use realistic test data
- Test edge cases and error conditions
- Keep tests fast and isolated
- Name tests descriptively (`should do X when Y`)

### DON'T ❌

- Don't test implementation details
- Don't write fragile tests (break on refactoring)
- Don't skip tests in CI
- Don't test multiple things in one test
- Don't ignore failing tests

---

## 8. Recommended Implementation Order

### Phase 1: Foundation (Week 1)

- [ ] Set up Jest configuration
- [ ] Write unit tests for HeatTracker (critical logic)
- [ ] Write unit tests for AgentSelector (critical logic)
- [ ] Write unit tests for auth middleware (security)
- [ ] Add coverage reporting

### Phase 2: API Testing (Week 2)

- [ ] Write integration tests for messages API
- [ ] Write integration tests for OpenClaw Gateway
- [ ] Write integration tests for WebSocket
- [ ] Set up test database
- [ ] Add API test fixtures

### Phase 3: E2E Testing (Week 3)

- [ ] Write critical flow E2E tests
- [ ] Set up Playwright in CI
- [ ] Add screenshot on failure
- [ ] Add video recording for debugging
- [ ] Test Feishu integration (staging)

### Phase 4: Performance & Monitoring (Week 4)

- [ ] Set up k6 for load testing
- [ ] Define performance budgets
- [ ] Add performance tests to CI (optional)
- [ ] Set up monitoring alerts
- [ ] Document testing strategy

---

## 9. Test Data Management

### Fixtures

```typescript
// tests/fixtures/agents.ts
export const testAgents = {
  mom: {
    id: 'family-mom',
    name: 'Mom',
    role: 'mother',
    personality: { talkativeness: 8, empathy: 9, curiosity: 6 }
  },
  dad: {
    id: 'family-dad',
    name: 'Dad',
    role: 'father',
    personality: { talkativeness: 5, empathy: 4, curiosity: 7 }
  }
};
```

### Factories

```typescript
// tests/factories/messageFactory.ts
export function createMessage(overrides = {}) {
  return {
    id: uuid(),
    content: 'Test message',
    senderType: 'human',
    roomId: 'test-room',
    createdAt: new Date(),
    ...overrides
  };
}
```

---

## Summary

### Recommended Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit** | Jest | Fast, isolated tests |
| **Integration** | Jest + Supertest | API, DB, external services |
| **E2E** | Playwright | Complete user flows |
| **Performance** | k6 | Load testing |
| **Coverage** | Istanbul (via Jest) | Coverage reporting |
| **CI/CD** | GitHub Actions | Automated testing |

### Quick Start

```bash
# Install test dependencies
npm install -D jest @types/jest ts-jest supertest @types/supertest

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

**Start with unit tests for critical services (HeatTracker, AgentSelector), then expand to integration and E2E tests!** 🚀
