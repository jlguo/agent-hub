# Test Suite Quick Reference

**For complete test writing rules, see:** [`../skills/test-writing-rules/SKILL.md`](../skills/test-writing-rules/SKILL.md)

---

## Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Validate all test rules (CI check)
npm run test:validate-rules

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed

# Watch mode (TDD)
npm run test:watch
```

---

## Test Structure

```
agent-hub/
├── src/
│   └── **/__tests__/
│       └── *.test.ts          # Unit tests
├── tests/
│   ├── integration/
│   │   └── *.test.ts           # Integration tests
│   ├── e2e/
│   │   └── *.spec.ts           # E2E tests
│   ├── fixtures/
│   ├── factories/
│   └── __mocks__/
└── scripts/
    └── validate-tests.ts       # Rule validation
```

---

## Writing Tests

### Unit Test Template

```typescript
// src/services/__tests__/MyService.test.ts
describe('MyService', () => {
  it('should [behavior] when [condition]', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Integration Test Template

```typescript
// tests/integration/api/myFeature.test.ts
import request from 'supertest';
import { app } from '../../src/index';

describe('My Feature API', () => {
  it('should create resource and return 201', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ /* data */ })
      .expect(201);
  });
});
```

### E2E Test Template

```typescript
// tests/e2e/myFeature.spec.ts
import { test, expect } from '@playwright/test';

test('should complete user flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('input', 'test');
  await page.click('button');
  await expect(page.locator('.result')).toBeVisible();
});
```

---

## Test Rules Summary

**Full rules:** [`../skills/test-writing-rules/SKILL.md`](../skills/test-writing-rules/SKILL.md)

### Required for All Changes

- ✅ Unit tests for new services/functions
- ✅ Integration tests for API endpoints
- ✅ E2E tests for critical user flows (if user-facing)
- ✅ Coverage >= 85% overall, 90% services, 95% middleware
- ✅ Mock external services (OpenClaw, Feishu)
- ✅ Use factories/fixtures for test data
- ✅ Test naming: `should [behavior] when [condition]`

### Before Committing

```bash
# Always run validation
npm run test:validate-rules
```

---

## Troubleshooting

### Tests Not Found

```bash
# Regenerate Prisma client
npm run db:generate

# Rebuild
npm run build
```

### Coverage Too Low

```bash
# See what's not covered
npm run test:coverage
open coverage/index.html
```

### Flaky Tests

```bash
# Run test multiple times to verify
for i in {1..5}; do npm test -- MyTest.test.ts; done
```

---

## CI/CD Integration

Tests run automatically on:
- Every PR (GitHub Actions)
- Pre-commit hook (husky)
- Pre-push hook

**Fails merge if:**
- Coverage < 85%
- Test files missing for changed code
- Skipped tests in main branch
- Test naming convention violated

---

**Questions?** See [`../skills/test-writing-rules/SKILL.md`](../skills/test-writing-rules/SKILL.md) for complete rules.
