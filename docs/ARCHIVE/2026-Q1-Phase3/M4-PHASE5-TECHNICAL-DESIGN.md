# Milestone 4 Phase 5: Enforcement - Technical Design

**Version**: 1.0  
**Date**: 2026-04-02  
**Status**: READY FOR IMPLEMENTATION  
**Estimated Effort**: 7 hours

---

## Overview

Phase 5 focuses on **automated enforcement** of test quality standards to ensure long-term maintainability and prevent regression.

### Goals

- [ ] Enforce 85% code coverage threshold
- [ ] Run tests automatically on every commit
- [ ] Block PRs that don't meet quality standards
- [ ] Provide fast feedback to developers
- [ ] Automate test execution in CI/CD

### Success Criteria

1. Pre-commit hooks run tests in <30 seconds
2. CI pipeline blocks PRs with failing tests
3. Coverage reports generated automatically
4. Coverage threshold enforced (85% minimum)
5. Test results visible in GitHub PR UI

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Pre-Commit Hook (Husky + lint-staged)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Run unit tests (affected files only)              │   │
│  │ 2. Check coverage threshold (local)                  │   │
│  │ 3. Lint changed files                                │   │
│  │ 4. Block commit if checks fail                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Push → GitHub Actions CI/CD                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Install dependencies                              │   │
│  │ 2. Run all tests (unit + E2E)                        │   │
│  │ 3. Generate coverage report                          │   │
│  │ 4. Upload coverage to Codecov                        │   │
│  │ 5. Block merge if tests fail or coverage < 85%       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Coverage & Quality Reporting                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ - Codecov.io integration                             │   │
│  │ - GitHub PR comments with coverage diff              │   │
│  │ - Test result summaries                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### 1. Pre-Commit Hooks (Husky + lint-staged)

#### Dependencies

```json
{
  "devDependencies": {
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

#### Configuration Files

**`.husky/pre-commit`** (executable script):

```bash
#!/usr/bin/env bash
echo "🔍 Running pre-commit checks..."

# Run lint-staged
npx lint-staged

# Run unit tests (fast mode - affected files only)
echo "🧪 Running unit tests..."
npm run test:unit -- --findRelatedTests $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$' | tr '\n' ' ')

# Check if tests passed
if [ $? -ne 0 ]; then
  echo "❌ Pre-commit checks failed!"
  exit 1
fi

echo "✅ Pre-commit checks passed!"
exit 0
```

**`lint-staged.config.js`**:

```javascript
export default {
  '*.{ts,js}': ['eslint --fix', 'prettier --write'],
  '*.{ts,js,json,md}': ['prettier --write'],
};
```

**`package.json` scripts**:

```json
{
  "scripts": {
    "prepare": "husky install",
    "test:pre-commit": "jest --config=server/jest.config.js --findRelatedTests",
    "test:coverage:check": "jest --config=server/jest.config.js --coverage --coverageThreshold='{\"global\":{\"branches\":70,\"functions\":80,\"lines\":80,\"statements\":80}}'"
  }
}
```

#### Implementation Steps

1. Install husky: `npm install -D husky lint-staged`
2. Initialize husky: `npx husky install`
3. Create pre-commit hook: `npx husky add .husky/pre-commit 'npx lint-staged'`
4. Add lint-staged config file
5. Update package.json scripts
6. Test with sample commit

**Estimated Time**: 1 hour

---

### 2. CI/CD Pipeline (GitHub Actions)

#### Workflow File: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  test:
    name: Test & Coverage
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit
        env:
          CI: true

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: false
          token: ${{ secrets.CODECOV_TOKEN }}

  lint:
    name: Lint & Format
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check Prettier formatting
        run: npm run format:check

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test, lint]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build backend
        run: npm run build:server

      - name: Build frontend
        run: npm run build:client
```

#### Implementation Steps

1. Create `.github/workflows/` directory
2. Add `ci.yml` workflow file
3. Configure Codecov integration (free for open source)
4. Add Codecov badge to README
5. Test workflow on PR

**Estimated Time**: 2 hours

---

### 3. Coverage Threshold Enforcement

#### Jest Configuration (`server/jest.config.js`)

```javascript
export default {
  // ... existing config
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.d.ts',
    '!server/src/**/__tests__/**',
    '!server/src/lib/prisma.ts',
    '!server/src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Per-file thresholds for critical services
    './server/src/services/MessageService.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './server/src/services/HeatTracker.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
};
```

#### Coverage Report Script (`scripts/check-coverage.ts`)

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const COVERAGE_FILE = join(process.cwd(), 'coverage/coverage-summary.json');
const THRESHOLDS = {
  lines: 85,
  statements: 85,
  functions: 85,
  branches: 70,
};

interface CoverageSummary {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}

const checkCoverage = () => {
  try {
    const data: CoverageSummary = JSON.parse(readFileSync(COVERAGE_FILE, 'utf-8'));
    const { total } = data;

    const checks = [
      { name: 'Lines', actual: total.lines.pct, threshold: THRESHOLDS.lines },
      { name: 'Statements', actual: total.statements.pct, threshold: THRESHOLDS.statements },
      { name: 'Functions', actual: total.functions.pct, threshold: THRESHOLDS.functions },
      { name: 'Branches', actual: total.branches.pct, threshold: THRESHOLDS.branches },
    ];

    let allPassed = true;

    console.log('📊 Coverage Report\n');
    console.log('Metric\t\tRequired\tActual\t\tStatus');
    console.log('───────\t\t────────\t──────\t\t──────');

    checks.forEach((check) => {
      const passed = check.actual >= check.threshold;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${check.name}\t\t${check.threshold}%\t\t${check.actual.toFixed(1)}%\t\t${status}`
      );

      if (!passed) allPassed = false;
    });

    console.log('');

    if (!allPassed) {
      console.error('❌ Coverage thresholds not met!');
      process.exit(1);
    } else {
      console.log('✅ All coverage thresholds met!');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error reading coverage file:', error);
    process.exit(1);
  }
};

checkCoverage();
```

#### Package.json Scripts

```json
{
  "scripts": {
    "test:coverage": "jest --config=server/jest.config.js --coverage",
    "test:coverage:check": "npm run test:coverage && npx tsx scripts/check-coverage.ts",
    "ci:test": "npm run test:coverage:check"
  }
}
```

**Estimated Time**: 1.5 hours

---

### 4. PR Quality Gates

#### GitHub Branch Protection Rules

Configure in GitHub Settings → Branches → Branch protection rules:

**Rule: `master` branch**

- [x] Require a pull request before merging
  - [x] Require approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `test (18.x)`
    - `test (20.x)`
    - `lint`
    - `build`
- [x] Require conversation resolution before merging
- [x] Include administrators

#### PR Template (`.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Description

<!-- Describe your changes in detail -->

## Related Issue

<!-- Link to related issue(s) -->

Fixes #

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing

- [ ] I have added unit tests that prove my fix/feature works
- [ ] I have added E2E tests that verify the full flow
- [ ] All tests pass locally
- [ ] Coverage threshold met (85%+)

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have updated the documentation accordingly
- [ ] I have added tests to cover my changes
- [ ] My changes generate no new warnings
- [ ] Coverage reports uploaded to Codecov

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->
```

**Estimated Time**: 0.5 hours

---

### 5. Monitoring & Reporting

### Codecov Integration

**Setup**:

1. Sign up at https://codecov.io (free for open source)
2. Connect GitHub repository
3. Add `CODECOV_TOKEN` to GitHub Secrets
4. Workflow automatically uploads coverage

**Features**:

- Coverage diff on PRs
- Historical coverage trends
- File-level coverage visualization
- Slack/email notifications on coverage drops

### Test Result Reporting

**Jest HTML Reporter** (`package.json`):

```json
{
  "devDependencies": {
    "jest-html-reporter": "^3.10.0"
  }
}
```

**Jest Config Addition**:

```javascript
reporters: [
  'default',
  ['jest-html-reporter', {
    pageTitle: 'Agent Hub Test Report',
    outputPath: 'coverage/test-report.html',
    includeFailureMsg: true,
    includeConsoleLog: true,
  }],
],
```

**Estimated Time**: 1 hour

---

## Implementation Plan

### Task Breakdown

| Task                               | Priority | Effort | Dependencies   |
| ---------------------------------- | -------- | ------ | -------------- |
| 1. Husky + lint-staged setup       | P0       | 1h     | None           |
| 2. GitHub Actions workflow         | P0       | 2h     | None           |
| 3. Coverage threshold script       | P0       | 1.5h   | None           |
| 4. Codecov integration             | P1       | 1h     | GitHub Actions |
| 5. PR template & branch protection | P1       | 0.5h   | GitHub Actions |
| 6. Test HTML reporter              | P2       | 1h     | None           |

**Total Estimated Effort**: 7 hours

### Implementation Order

**Week 1 (Phase 5 Sprint)**:

1. Day 1: Husky + lint-staged (Task 1)
2. Day 2: GitHub Actions CI/CD (Task 2)
3. Day 3: Coverage enforcement (Task 3)
4. Day 4: Codecov + reporting (Task 4-6)

---

## Acceptance Criteria

### Definition of Done

- [ ] Pre-commit hooks run automatically on `git commit`
- [ ] Pre-commit hooks complete in <30 seconds
- [ ] CI pipeline runs on every PR
- [ ] CI pipeline blocks merge on test failures
- [ ] Coverage threshold enforced (85% minimum)
- [ ] Coverage reports visible in Codecov
- [ ] PR template enforces quality checklist
- [ ] Branch protection rules configured
- [ ] All documentation updated

### Quality Metrics

- Pre-commit hook execution time: <30s
- CI pipeline execution time: <10min
- Test failure detection: Immediate (pre-commit)
- Coverage threshold: 85%+ enforced
- False positive rate: <1%

---

## Risks & Mitigations

### Risk 1: Pre-commit hooks slow down development

**Mitigation**:

- Run only affected tests (findRelatedTests)
- Set 30-second timeout
- Provide `--no-verify` escape hatch for emergencies

### Risk 2: CI pipeline too slow

**Mitigation**:

- Use GitHub Actions cache for npm dependencies
- Run tests in parallel (unit + E2E separate jobs)
- Target <10 minute total pipeline time

### Risk 3: Coverage threshold blocks legitimate changes

**Mitigation**:

- Allow coverage exemptions with code comments
- Require team lead approval for threshold bypass
- Focus on critical services first (MessageService, HeatTracker)

### Risk 4: False positives in CI

**Mitigation**:

- Flaky test detection and quarantine
- Retry mechanism for transient failures
- Clear error messages in CI logs

---

## Future Enhancements (Post-Phase 5)

### Phase 5.5: Advanced Testing

- [ ] Visual regression testing (Playwright)
- [ ] Performance testing (k6)
- [ ] Load testing for WebSocket connections
- [ ] Chaos testing for resilience

### Phase 6: DevOps Maturity

- [ ] Automated deployments (staging/production)
- [ ] Database migration automation
- [ ] Rollback mechanisms
- [ ] Blue-green deployments

---

## Appendix

### A. Package Dependencies

```json
{
  "devDependencies": {
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "jest-html-reporter": "^3.10.0",
    "@codecov/rollup-plugin": "^1.0.0"
  }
}
```

### B. Environment Variables

```bash
# CI/CD Secrets (GitHub Secrets)
CODECOV_TOKEN=xxx
DATABASE_URL=file:./prisma/test.db
OPENCLAW_VERIFICATION_TOKEN=xxx
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx
```

### C. Useful Commands

```bash
# Run pre-commit checks manually
npx lint-staged
npm run test:pre-commit

# Run coverage check
npm run test:coverage:check

# Run CI locally
npm run ci:test

# Generate HTML test report
npm run test:coverage
open coverage/test-report.html
```

---

## Review Checklist

- [ ] Technical design reviewed by team
- [ ] Implementation plan approved
- [ ] Risks identified and mitigated
- [ ] Acceptance criteria clear and measurable
- [ ] Documentation complete
- [ ] Ready for implementation

---

**Next Step**: Begin implementation with Task 1 (Husky + lint-staged setup)
