# Automated Test Maintenance Guide

**Best practices for keeping your test suite healthy, fast, and valuable**

---

## Core Principles

### 1. Tests Are Code Too 📝

Treat tests with the same care as production code:
- ✅ Code review for test changes
- ✅ Refactor tests to reduce duplication
- ✅ Document complex test logic
- ✅ Keep tests under version control

### 2. Test the Behavior, Not Implementation 🔍

**Bad** (breaks on refactoring):
```typescript
it('should call calculateScore with weights [3.0, 2.5, 2.5]', () => {
  expect(mock.calculateScore).toHaveBeenCalledWith([3.0, 2.5, 2.5]);
});
```

**Good** (stable across refactoring):
```typescript
it('should select agent with highest personality score', () => {
  const result = await selectAgent(messages, agents);
  expect(result.selectedAgent.name).toBe('Mom'); // Mom has highest empathy
});
```

### 3. Fast Feedback Loop ⚡

**Goal**: < 10 minutes for full test suite

| Test Type | Target Time | Run Frequency |
|-----------|-------------|---------------|
| Unit Tests | < 1 minute | Every save (watch mode) |
| Integration Tests | < 5 minutes | Every commit |
| E2E Tests | < 10 minutes | Nightly + pre-deployment |

---

## Test Organization

### File Structure

```
agent-hub/
├── src/
│   ├── services/
│   │   ├── MessageService.ts
│   │   └── __tests__/
│   │       ├── MessageService.test.ts
│   │       └── MessageService.test.ts.snap
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── __tests__/
│   │       └── auth.test.ts
├── tests/
│   ├── integration/
│   │   ├── api/
│   │   │   ├── messages.test.ts
│   │   │   └── openclaw-gateway.test.ts
│   │   └── database/
│   │       └── relationships.test.ts
│   ├── e2e/
│   │   ├── critical-flows.spec.ts
│   │   ├── agent-responses.spec.ts
│   │   └── feishu-integration.spec.ts
│   ├── fixtures/
│   │   ├── agents.ts
│   │   └── messages.ts
│   └── factories/
│       └── messageFactory.ts
```

### Test Naming Convention

```typescript
// Format: should [expected behavior] when [condition]
describe('MessageService', () => {
  describe('selectAgentWithMention', () => {
    it('should select mentioned agent with 100% priority when @mention is present', () => {});
    it('should skip agents on cooldown when checking @mentions', () => {});
    it('should use smart fallback when @mention does not match any agent', () => {});
  });
});
```

---

## Maintenance Strategies

### 1. Regular Test Reviews 📅

**Weekly** (15 minutes):
- Check for flaky tests
- Review test execution times
- Remove skipped tests (`test.skip()`)

**Monthly** (1 hour):
- Audit test coverage gaps
- Refactor duplicated test logic
- Update outdated test data

**Quarterly** (half day):
- Major test suite refactoring
- Delete obsolete tests
- Update testing tools and libraries

### 2. Flaky Test Management 🔧

**Identify Flaky Tests**:
```bash
# Run tests multiple times to find flakiness
for i in {1..10}; do npm test; done | grep -E "(PASS|FAIL)" | sort | uniq -c
```

**Fix Flaky Tests**:
```typescript
// ❌ Bad: Timing-dependent
it('should load messages', async () => {
  await page.click('button');
  await waitFor(1000); // Arbitrary wait
  expect(await page.locator('.message').count()).toBeGreaterThan(0);
});

// ✅ Good: Wait for specific condition
it('should load messages', async () => {
  await page.click('button');
  await page.waitForSelector('.message', { timeout: 5000 });
  expect(await page.locator('.message').count()).toBeGreaterThan(0);
});
```

**Quarantine Flaky Tests**:
```typescript
// Move to separate file for investigation
describe.skip('Flaky: Agent Response', () => {
  it('should respond within 30 seconds', async () => {
    // Under investigation
  });
});
```

### 3. Test Data Management 🗄️

**Use Factories**:
```typescript
// tests/factories/messageFactory.ts
export function createMessage(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    content: 'Test message',
    senderType: 'human',
    roomId: 'test-room',
    createdAt: new Date(),
    ...overrides
  };
}

// Usage
const message = createMessage({ content: 'Custom content', senderType: 'agent' });
```

**Use Fixtures**:
```typescript
// tests/fixtures/agents.ts
export const testAgents = {
  mom: { id: 'family-mom', name: 'Mom', role: 'mother' },
  dad: { id: 'family-dad', name: 'Dad', role: 'father' },
};

// Usage
import { testAgents } from '../fixtures/agents';
```

**Reset Database Between Tests**:
```typescript
// tests/integration/database.test.ts
beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.discussion.deleteMany();
  // Reset to clean state
});
```

### 4. Mocking External Services 🎭

**Mock OpenClaw**:
```typescript
// tests/__mocks__/OpenClawService.ts
export const mockOpenClawService = {
  sendMessage: jest.fn().mockResolvedValue({
    content: 'Mocked AI response',
    usage: { totalTokens: 100, cost: 0.001 }
  })
};

// Usage in test
jest.mock('../../src/services/OpenClawService');
```

**Mock Feishu API**:
```typescript
// tests/__mocks__/FeishuService.ts
export const mockFeishuService = {
  sendMessage: jest.fn().mockResolvedValue(undefined)
};

// Usage
jest.mock('../../src/services/FeishuService');
```

**Use MSW for API Mocking** (Advanced):
```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.post('http://localhost:4000/api/openclaw/gateway', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      content: 'Mocked response'
    }));
  })
];

// Setup in test setup file
import { setupServer } from 'msw/node';
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
```

---

## Common Maintenance Issues

### Issue 1: Tests Break on Refactoring

**Problem**: Tests check implementation details
```typescript
// ❌ Fragile
it('should call heatTracker.updateHeat with discussionId', () => {
  expect(mockHeatTracker.updateHeat)
    .toHaveBeenCalledWith(discussionId, context, agentId);
});
```

**Solution**: Test outcomes, not implementation
```typescript
// ✅ Stable
it('should increase discussion heat after user message', async () => {
  await sendMessage('Hello!');
  const discussion = await getDiscussion();
  expect(discussion.heat).toBeGreaterThan(0);
});
```

### Issue 2: Tests Are Too Slow

**Problem**: Test suite takes > 30 minutes

**Solutions**:
1. **Parallelize Tests**:
   ```bash
   # Jest runs tests in parallel by default
   npm test -- --maxWorkers=4
   ```

2. **Split Test Suites**:
   ```json
   // package.json
   {
     "scripts": {
       "test:unit": "jest --testPathPattern=unit",
       "test:integration": "jest --testPathPattern=integration",
       "test:e2e": "playwright test"
     }
   }
   ```

3. **Use Test Sharding** (CI):
   ```yaml
   # GitHub Actions
   strategy:
     matrix:
       shard: [1/3, 2/3, 3/3]
   steps:
     - run: npm run test:e2e -- --shard=${{ matrix.shard }}
   ```

### Issue 3: Tests Fail Intermittently

**Problem**: Flaky tests fail randomly

**Root Causes & Fixes**:

| Cause | Fix |
|-------|-----|
| Timing issues | Use `waitForSelector` instead of `setTimeout` |
| Shared state | Reset database/state between tests |
| Network calls | Mock external services |
| Race conditions | Use proper async/await patterns |
| Browser state | Use fresh browser context per test |

### Issue 4: Test Coverage Decreases

**Problem**: New code isn't tested

**Solutions**:
1. **Enforce Coverage in CI**:
   ```json
   // package.json
   {
     "jest": {
       "coverageThreshold": {
         "global": {
           "branches": 80,
           "functions": 80,
           "lines": 80,
           "statements": 80
         }
       }
     }
   }
   ```

2. **Review Coverage Reports**:
   ```bash
   npm run test:coverage
   open coverage/index.html
   ```

3. **Require Tests in PR Template**:
   ```markdown
   ## PR Checklist
   - [ ] Tests added/updated
   - [ ] Coverage maintained or improved
   - [ ] All tests passing locally
   ```

---

## Automation & Tooling

### 1. Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:ci"
    }
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "jest --findRelatedTests --bail"
    ]
  }
}
```

### 2. Automated Test Reports

```yaml
# .github/workflows/test-report.yml
name: Test Report
on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]
    types:
      - completed

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/test-reporter@v1
        with:
          name: Jest Tests
          path: reports/junit.xml
          reporter: jest-junit
```

### 3. Test Analytics

**Track Metrics**:
```typescript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Test Report',
      outputPath: 'reports/test-report.html'
    }]
  ]
};
```

**Monitor Over Time**:
- Test execution time trends
- Flakiness rate
- Coverage trends
- Failures by component

---

## Documentation & Knowledge Sharing

### 1. Test README

```markdown
# tests/README.md

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# E2E tests (headed mode)
npm run test:e2e:headed
```

## Writing Tests

- Unit tests: `src/**/__tests__/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`
- E2E tests: `tests/e2e/**/*.spec.ts`

## Test Data

- Fixtures: `tests/fixtures/`
- Factories: `tests/factories/`
- Mocks: `tests/__mocks__/`

## Debugging

```bash
# Run single test file
npm test -- MessageService.test.ts

# Debug E2E test
npm run test:e2e:headed -- critical-flows.spec.ts

# Watch mode
npm run test:watch
```
```

### 2. Test Decision Log

```markdown
# docs/TEST-DECISIONS.md

## 2026-04-02: Chose Playwright for E2E

**Decision**: Use Playwright instead of Cypress

**Rationale**:
- Better TypeScript support
- Faster execution
- Multi-browser testing
- Already configured in project

**Trade-offs**:
- Smaller community than Cypress
- Less GUI tooling

## 2026-04-02: 85% Coverage Target

**Decision**: Target 85% overall coverage

**Rationale**:
- 100% is diminishing returns
- Focus on critical paths (services, middleware)
- Allow lower coverage for UI components
```

---

## Team Practices

### 1. Test Code Reviews

**Checklist for PR Reviews**:
- [ ] Tests cover new functionality
- [ ] Tests are descriptive (clear naming)
- [ ] No hardcoded values (use fixtures/factories)
- [ ] Tests are isolated (no shared state)
- [ ] Mocks used for external services
- [ ] Test execution time is reasonable

### 2. Test Ownership

**Assign Test Champions**:
```markdown
# docs/TEST-OWNERSHIP.md

## Test Areas & Owners

| Area | Owner | Backup |
|------|-------|--------|
| Unit Tests | @dev1 | @dev2 |
| Integration Tests | @dev2 | @dev3 |
| E2E Tests | @dev3 | @dev1 |
| Performance Tests | @dev1 | @dev2 |

## Responsibilities

- Review test PRs in their area
- Monitor test health metrics
- Lead test refactoring efforts
- Mentor team on testing best practices
```

### 3. Test Retrospectives

**Monthly Test Retrospective** (30 minutes):

**Agenda**:
1. Review test metrics (5 min)
   - Execution time trends
   - Flakiness rate
   - Coverage changes
2. Discuss pain points (10 min)
   - What tests are frustrating?
   - What's slowing us down?
3. Identify improvements (10 min)
   - What can we automate?
   - What should we refactor?
4. Action items (5 min)
   - Assign owners
   - Set deadlines

---

## Continuous Improvement

### Metrics to Track

```typescript
// Example metrics dashboard
{
  testSuite: {
    totalTests: 156,
    passingTests: 154,
    failingTests: 2,
    skippedTests: 0,
    flakyTests: 3,
    
    executionTime: {
      total: '8m 32s',
      average: '3.2s',
      slowest: '28s (E2E: agent discussion)'
    },
    
    coverage: {
      statements: 87.3,
      branches: 84.1,
      functions: 89.7,
      lines: 86.9
    }
  }
}
```

### Improvement Backlog

```markdown
# docs/TEST-IMPROVEMENT-BACKLOG.md

## Backlog

### P0 - Critical
- [ ] Fix flaky E2E test: agent discussion timing
- [ ] Reduce integration test time from 8m to 5m

### P1 - Important
- [ ] Add unit tests for DiscussionService
- [ ] Mock Feishu API in integration tests
- [ ] Set up test analytics dashboard

### P2 - Nice to Have
- [ ] Visual regression testing for UI
- [ ] Performance tests in CI
- [ ] Test data management tool

## Completed

- ✅ Set up Playwright E2E tests (2026-03-29)
- ✅ Added coverage reporting (2026-04-01)
- ✅ Configured parallel test execution (2026-04-02)
```

---

## Quick Reference

### Maintenance Checklist

**Daily**:
- [ ] Check CI test results
- [ ] Fix any new failing tests immediately

**Weekly**:
- [ ] Review flaky test report
- [ ] Check test execution time trends
- [ ] Remove `test.skip()` calls

**Monthly**:
- [ ] Audit test coverage gaps
- [ ] Refactor duplicated test logic
- [ ] Update test documentation
- [ ] Review and update mocks

**Quarterly**:
- [ ] Major test suite refactoring
- [ ] Delete obsolete tests
- [ ] Update testing tools/libraries
- [ ] Test retrospective with team

### Common Commands

```bash
# Run tests
npm test                           # All tests
npm run test:unit                  # Unit tests
npm run test:integration           # Integration tests
npm run test:e2e                   # E2E tests

# Debugging
npm run test:watch                 # Watch mode
npm run test:e2e:headed            # See browser
npm test -- --verbose              # Detailed output

# Coverage
npm run test:coverage              # With coverage
open coverage/index.html           # View report

# CI
npm run test:ci                    # CI mode (no watch)
```

---

## Summary

### Golden Rules

1. ✅ **Test behavior, not implementation** - Tests survive refactoring
2. ✅ **Keep tests fast** - < 10 minutes for full suite
3. ✅ **Fix flaky tests immediately** - Don't let them accumulate
4. ✅ **Use factories and fixtures** - DRY test data
5. ✅ **Mock external services** - Isolate your tests
6. ✅ **Review tests in PRs** - Maintain quality
7. ✅ **Track metrics** - You can't improve what you don't measure
8. ✅ **Document test decisions** - Future you will thank you

### Maintenance Effort

| Activity | Time Investment | Frequency |
|----------|----------------|-----------|
| Daily CI checks | 5 minutes | Daily |
| Fix flaky tests | 30 minutes | Weekly |
| Test refactoring | 2 hours | Monthly |
| Tool updates | 4 hours | Quarterly |
| **Total** | **~10 hours/month** | |

**Rule of Thumb**: Spend 20% of development time on test maintenance

---

**Remember**: A well-maintained test suite is your safety net. Invest in it consistently! 🚀
