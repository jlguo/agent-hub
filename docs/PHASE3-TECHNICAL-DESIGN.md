# Phase 3: Testing & Validation - Technical Design

**Goal:** Increase test coverage from 7.5% to 85% enforced  
**Timeline:** 5-7 days (40-50 hours)  
**Priority:** P0 (Must-Have Blocker for Production)

---

## Current State Analysis

### Test Coverage (Baseline)

| Metric            | Current    | Target       | Gap         |
| ----------------- | ---------- | ------------ | ----------- |
| Overall Coverage  | 7.5%       | 85%          | -77.5%      |
| Unit Tests        | ~63 tests  | 150+ tests   | -87 tests   |
| Integration Tests | 0 tests    | 30+ tests    | -30 tests   |
| E2E Tests         | 4 tests    | 15+ tests    | -11 tests   |
| Services Tested   | 3/12 (25%) | 12/12 (100%) | -9 services |

### Existing Test Infrastructure

✅ **Completed (Phase 2):**

- Jest configuration (`server/jest.config.js`)
- Test database setup (`scripts/setup-test-db.ts`)
- Test factories (`tests/factories/`)
- Pre-commit hooks (Husky + lint-staged)
- GitHub Actions CI/CD pipeline
- Coverage check script (`scripts/check-coverage.ts`)

✅ **Test Suites Passing:**

- `error-handler.test.ts` - 16 tests
- `MessageService.test.ts` - 17 tests
- `HeatTracker.test.ts` - 30 tests
- E2E tests (Playwright) - 4 tests

**Total:** 67 tests passing

---

## Phase 3 Implementation Plan

### Task 1: Infrastructure Enhancement (9 hours)

**Goal:** Prepare test infrastructure for scale

**Subtasks:**
1.1 ✅ Jest configuration optimization (DONE)
1.2 ⏳ Test database isolation (per-test cleanup)
1.3 ⏳ Mock factories for external services (OpenClaw, Feishu)
1.4 ⏳ Test utilities and helpers
1.5 ⏳ Coverage threshold configuration (gradual increase)

**Deliverables:**

- Automated test DB cleanup between tests
- Mock generators for OpenClawService, FeishuService
- Test result reporters (HTML + JSON)
- Coverage thresholds: 20% (Phase 1), 40% (Phase 2), 60% (Phase 3), 85% (final)

---

### Task 2: Unit Tests - Core Services (15 hours)

**Goal:** 70% of codebase covered by unit tests (100+ tests)

**Priority Order:**

#### P0 - Critical Services (6 hours)

1. **OpenClawService** - 20 tests
   - CLI mode execution
   - Remote mode health checks
   - Agent response parsing
   - Error handling
   - Timeout handling

2. **AgentSelector** - 15 tests
   - 6-factor scoring algorithm
   - @mention priority logic
   - Cooldown system
   - Relationship weight calculation

3. **HeatTracker** - Already complete (30 tests) ✅

#### P1 - Important Services (5 hours)

4. **DiscussionService** - 15 tests
   - Discussion initiation
   - Turn management
   - Agent selection for discussions
   - System message generation

5. **MessageService** - Already complete (17 tests) ✅

6. **FeishuService** - 10 tests
   - Message sending
   - Token refresh
   - Error handling

#### P2 - Supporting Services (4 hours)

7. **RoomsService** - 10 tests
8. **AgentsService** - 10 tests
9. **SessionGuardian** - 10 tests
10. **Auth middleware** - 10 tests

**Total Unit Tests:** 137 tests (63 existing + 74 new)

---

### Task 3: Integration Tests - API Endpoints (13 hours)

**Goal:** All API endpoints tested with real database (30+ tests)

**Test Strategy:**

- Use Supertest for HTTP assertions
- Real test database (SQLite)
- Mock external services (OpenClaw, Feishu)
- Test authentication flows

#### API Endpoints to Test:

1. **Health Endpoints** - 5 tests
   - `GET /health`
   - `GET /health/remote`
   - `GET /health/quick`
   - OpenClaw integration
   - Database connectivity

2. **Rooms API** - 8 tests
   - `GET /api/rooms` - List all rooms
   - `GET /api/rooms/:id` - Get room details
   - `POST /api/rooms` - Create room
   - `PUT /api/rooms/:id` - Update room
   - `DELETE /api/rooms/:id` - Delete room
   - Room with agents include
   - Room with messages include
   - Error cases (404, validation)

3. **Agents API** - 8 tests
   - `GET /api/agents` - List all agents
   - `GET /api/agents/:id` - Get agent details
   - `POST /api/agents` - Create agent
   - `PUT /api/agents/:id` - Update agent
   - `DELETE /api/agents/:id` - Delete agent
   - Agent relationships include
   - Filter by role
   - Error cases

4. **Messages API** - 12 tests
   - `GET /api/messages/rooms/:roomId` - Get messages
   - `POST /api/messages/rooms/:roomId` - Send message
   - Message pagination
   - Message filtering by senderType
   - Agent response triggering
   - @mention detection
   - Discussion triggering
   - WebSocket emission
   - Error cases (empty message, invalid room)
   - Rate limiting
   - Message persistence
   - Message retrieval performance

5. **Webhooks API** - 5 tests
   - Feishu webhook handling
   - OpenClaw webhook handling
   - Token verification
   - Payload validation
   - Error handling

**Total Integration Tests:** 38 tests

---

### Task 4: E2E Tests - Critical User Flows (11 hours)

**Goal:** 15+ E2E tests covering all critical paths

**Test Strategy:**

- Use Playwright (already configured)
- Test real browser interactions
- Test with real database
- Mock external services if needed
- Run in headless mode for CI

#### E2E Test Scenarios:

1. **User Authentication** - 3 tests
   - Login flow
   - JWT token validation
   - Session persistence

2. **Room Management** - 3 tests
   - Create new room
   - View room with messages
   - Room settings update

3. **Message Sending** - 4 tests
   - Send user message
   - Receive agent response
   - @mention specific agent
   - Multi-turn conversation

4. **Agent Discussions** - 3 tests (already have 2 ✅)
   - Trigger discussion with /discuss
   - Discussion turn management
   - Discussion completion

5. **Heat System** - 2 tests
   - Heat increases with messages
   - Agent response probability

**Total E2E Tests:** 15 tests (4 existing + 11 new)

---

### Task 5: Enforcement & CI/CD (7 hours)

**Goal:** Enforce 85% coverage threshold in CI/CD

**Subtasks:**

5.1 **Pre-commit Hooks** ✅ (DONE in Phase 2)

- Run linting on staged files
- Run affected tests
- Block commits on test failures

  5.2 **CI/CD Pipeline** ✅ (DONE in Phase 2)

- GitHub Actions workflow
- Run all tests on PR
- Upload coverage reports

  5.3 **Coverage Threshold Enforcement**

- Gradual threshold increase:
  - Week 1: 20% (baseline)
  - Week 2: 40% (after unit tests)
  - Week 3: 60% (after integration)
  - Week 4: 80% (after E2E)
  - Final: 85% (enforced)

  5.4 **Coverage Reports**

- HTML reports (local)
- JSON reports (CI)
- Codecov integration (optional)

  5.5 **PR Quality Gates**

- Branch protection rules
- Required status checks
- Minimum coverage increase per PR

---

## Test Pyramid Target

```
        /\
       /  \
      / E2E \      15 tests (10%)
     /--------\
    /Integration\   38 tests (25%)
   /--------------\
  /     Unit       \  137 tests (65%)
 /------------------\
```

**Total Tests:** 190 tests  
**Coverage Target:** 85% overall

- Lines: 85%
- Statements: 85%
- Functions: 85%
- Branches: 75%

---

## Success Criteria

### Phase 3, Week 1 (Infrastructure + Unit Tests)

- [ ] Test DB isolation working
- [ ] Mock factories implemented
- [ ] 100+ unit tests passing
- [ ] 40% coverage threshold met

### Phase 3, Week 2 (Integration Tests)

- [ ] All API endpoints tested
- [ ] 30+ integration tests passing
- [ ] 60% coverage threshold met
- [ ] CI/CD running integration tests

### Phase 3, Week 3 (E2E Tests)

- [ ] 15+ E2E tests passing
- [ ] Critical user flows covered
- [ ] 80% coverage threshold met
- [ ] E2E tests in CI/CD

### Phase 3, Week 4 (Enforcement)

- [ ] 85% coverage enforced
- [ ] Pre-commit hooks blocking low coverage
- [ ] PR quality gates active
- [ ] Coverage reports in Codecov

---

## Risk Mitigation

### Risk 1: Test Flakiness

**Mitigation:**

- Use test factories (no hardcoded data)
- Isolate test databases
- Mock external services
- Add retry logic for E2E tests

### Risk 2: Slow Test Execution

**Mitigation:**

- Parallel test execution (where safe)
- Test sharding in CI
- Optimize database queries
- Cache test dependencies

### Risk 3: Coverage Plateaus

**Mitigation:**

- Focus on critical paths first
- Accept lower coverage for generated code
- Exclude test utilities from coverage
- Gradual threshold increase

---

## Tools & Dependencies

### Already Installed

- Jest (unit/integration testing)
- Playwright (E2E testing)
- Supertest (API testing)
- Faker (test data generation)
- Husky (pre-commit hooks)
- lint-staged (staged file linting)

### Additional (if needed)

- `jest-html-reporter` - HTML test reports
- `@types/supertest` - TypeScript types
- `testcontainers` - Docker-based test isolation (optional)

---

## Timeline

| Week      | Focus                 | Tests    | Coverage       | Hours   |
| --------- | --------------------- | -------- | -------------- | ------- |
| 1         | Infrastructure + Unit | 63 → 137 | 7.5% → 40%     | 24h     |
| 2         | Integration           | +38      | 40% → 60%      | 13h     |
| 3         | E2E                   | +15      | 60% → 80%      | 11h     |
| 4         | Enforcement           | -        | 80% → 85%      | 7h      |
| **Total** | **All**               | **190**  | **7.5% → 85%** | **55h** |

---

## Definition of Done

- [ ] 190+ tests passing
- [ ] 85% code coverage enforced
- [ ] All critical user flows tested
- [ ] CI/CD pipeline running all tests
- [ ] Pre-commit hooks active
- [ ] Coverage reports generated
- [ ] Test documentation complete
- [ ] Flaky tests < 5%

---

**Last Updated:** 2026-04-06  
**Status:** Ready to Start
