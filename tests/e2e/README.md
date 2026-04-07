# E2E Testing Guide

**Last Updated:** 2026-04-07  
**Test Isolation:** ✅ Complete (separate containers + database)

---

## 🎯 **Quick Start**

### **Run All E2E Tests**

```bash
./scripts/run-e2e-tests.sh
```

This will:

1. ✅ Start isolated test containers (backend-test + frontend-test)
2. ✅ Use separate test database (test.db)
3. ✅ Run all E2E tests
4. ✅ Clean up containers automatically
5. ✅ Preserve your dev database completely

---

## 🐳 **Test Architecture**

### **Isolated Test Environment**

| Component      | Dev Environment       | Test Environment                |
| -------------- | --------------------- | ------------------------------- |
| **Backend**    | localhost:4000        | localhost:4001                  |
| **Frontend**   | localhost:3000        | localhost:3001                  |
| **Database**   | prisma/dev.db         | prisma/test.db                  |
| **Containers** | backend-1, frontend-1 | backend-test-1, frontend-test-1 |
| **Network**    | agent-hub-network     | test-network                    |
| **Volumes**    | backend-data          | backend-test-data               |

**Key Benefit:** Tests run in complete isolation - zero impact on development!

---

## 📖 **How to Run Tests**

### **Option 1: Automated Script (Recommended)** ⭐

```bash
cd /home/jlguo/agent-hub
./scripts/run-e2e-tests.sh
```

**What happens:**

1. Stops any existing test containers
2. Builds test images (cached after first run)
3. Starts isolated containers
4. Waits for health checks (backend + frontend)
5. Runs all E2E tests
6. Cleans up containers
7. Shows test results

**Expected output:**

```
🚀 Starting E2E Tests with Isolated Containers
==============================================

Step 1: Stopping any existing test containers...
Step 2: Building test containers...
Step 3: Starting test containers...
Step 4: Waiting for containers to be healthy...
✅ Backend is healthy
✅ Frontend is healthy
✅ Test environment ready
Backend: http://localhost:4001
Frontend: http://localhost:3001

Step 5: Running E2E tests...
==============================================
Running 4 tests using 2 workers

  ✅  [chromium] › tests/e2e/discussion.spec.ts:19:3 › should trigger discussion (45.2s)
  ✅  [chromium] › tests/e2e/discussion.spec.ts:120:3 › should show system messages (12.8s)
  ✅  [webkit] › tests/e2e/discussion.spec.ts:19:3 › should trigger discussion (48.1s)
  ✅  [webkit] › tests/e2e/discussion.spec.ts:120:3 › should show system messages (13.2s)

  4 passed (120.5s)

==============================================
🎉 All E2E tests passed!
==============================================
```

---

### **Option 2: Manual Container Control**

```bash
# Start test containers
docker-compose -f docker-compose.test.yml up -d

# Wait for health (check manually)
docker-compose -f docker-compose.test.yml ps

# Run tests
npx playwright test tests/e2e/ --reporter=list

# View test environment
echo "Backend: http://localhost:4001"
echo "Frontend: http://localhost:3001"

# Stop containers when done
docker-compose -f docker-compose.test.yml down
```

---

### **Option 3: Run Specific Tests**

```bash
# Start test environment first
./scripts/run-e2e-tests.sh

# Then run specific test file
npx playwright test tests/e2e/discussion.spec.ts --reporter=list

# Or run specific test by name
npx playwright test tests/e2e/discussion.spec.ts -g "should trigger"

# Run with visible browser (for debugging)
npx playwright test tests/e2e/discussion.spec.ts --headed

# Run with HTML report
npx playwright test tests/e2e/discussion.spec.ts --reporter=html
npx playwright show-report
```

---

### **Option 4: Debug with UI Mode**

```bash
# Start test containers
docker-compose -f docker-compose.test.yml up -d

# Run tests with UI
npx playwright test tests/e2e/discussion.spec.ts --ui

# This opens Playwright UI for interactive debugging
```

---

## 🗄️ **Database Isolation**

### **Test Database Lifecycle**

```
Before Tests:
1. Create fresh test.db (or use existing)
2. Run migrations on test.db
3. Seed with test data
4. Mount to backend-test container

During Tests:
- All test operations use test.db
- Dev.db remains untouched
- Test data can be reset between tests

After Tests:
- Containers stopped and removed
- test.db preserved for next run
- Dev.db completely unaffected
```

### **Verify Isolation**

```bash
# Check databases exist separately
ls -lh prisma/*.db
# Expected:
# dev.db   - Your development data (protected)
# test.db  - Test data (safe to reset)

# Check which database containers are using
docker-compose -f docker-compose.test.yml exec backend-test ls -lh /app/prisma/
# Should show: test.db

docker-compose exec backend-1 ls -lh /app/prisma/
# Should show: dev.db
```

---

## 🔍 **Debugging Tests**

### **View Container Logs**

```bash
# See all logs
docker-compose -f docker-compose.test.yml logs -f

# See backend logs only
docker-compose -f docker-compose.test.yml logs -f backend-test

# See frontend logs only
docker-compose -f docker-compose.test.yml logs -f frontend-test

# Filter for errors
docker-compose -f docker-compose.test.yml logs backend-test | grep -i error
```

### **Access Test Environment**

```bash
# Backend shell
docker-compose -f docker-compose.test.yml exec backend-test sh

# Frontend shell
docker-compose -f docker-compose.test.yml exec frontend-test sh

# Check database
docker-compose -f docker-compose.test.yml exec backend-test ls -lh /app/prisma/

# View test.db content
docker-compose -f docker-compose.test.yml exec backend-test cat /app/prisma/test.db
```

### **Keep Containers Running**

If tests fail and you want to debug:

```bash
# Don't use the script (it auto-cleans)
# Instead, manually start containers:

docker-compose -f docker-compose.test.yml up -d

# Run tests manually
npx playwright test tests/e2e/discussion.spec.ts --reporter=list

# Containers stay running after test
# Inspect state, view logs, etc.

# When done, clean up
docker-compose -f docker-compose.test.yml down
```

---

## 📊 **Test Reports**

### **HTML Report**

```bash
# Generate HTML report
npx playwright test tests/e2e/ --reporter=html

# Open in browser
npx playwright show-report
```

**Features:**

- Test results with screenshots
- Execution traces
- Console logs
- Video recordings (if enabled)

### **Console Output**

```bash
# List reporter (default)
npx playwright test tests/e2e/discussion.spec.ts --reporter=list

# Line reporter (minimal)
npx playwright test tests/e2e/discussion.spec.ts --reporter=line

# JSON reporter (for CI/CD)
npx playwright test tests/e2e/discussion.spec.ts --reporter=json
```

---

## 🐛 **Troubleshooting**

### **Problem: Containers Won't Start**

```bash
# Check if ports are in use
lsof -i :4001
lsof -i :3001

# Kill if needed
kill -9 $(lsof -ti:4001)
kill -9 $(lsof -ti:3001)

# Try again
./scripts/run-e2e-tests.sh
```

### **Problem: Tests Timeout**

```bash
# Increase timeout
npx playwright test tests/e2e/discussion.spec.ts --timeout=120000

# Or edit playwright.config.ts
# Change: test.setTimeout(90000) → test.setTimeout(120000)
```

### **Problem: Database Errors**

```bash
# Reset test database
rm prisma/test.db
./scripts/run-e2e-tests.sh

# Or manually
docker-compose -f docker-compose.test.yml down -v
./scripts/run-e2e-tests.sh
```

### **Problem: Health Check Fails**

```bash
# Check container status
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs backend-test

# Manual health check
curl http://localhost:4001/health
```

---

## 🎯 **Best Practices**

### **Before Running Tests**

1. ✅ Ensure dev containers are running (optional)
2. ✅ Close any browsers on ports 3001/4001
3. ✅ Have 5-10 minutes for first run (build time)

### **During Test Development**

1. ✅ Use `--ui` mode for debugging
2. ✅ Use `--headed` to see browser
3. ✅ Use `--slowmo=1000` to slow down execution
4. ✅ Take screenshots in tests for debugging

### **After Tests**

1. ✅ Review HTML report for details
2. ✅ Check test-results/ for error contexts
3. ✅ Clean up if containers left running

---

## 📋 **Test Files**

### **Current Test Suite**

| File                 | Tests | Status            | Purpose            |
| -------------------- | ----- | ----------------- | ------------------ |
| `discussion.spec.ts` | 2     | ✅ Fixed          | Discussion feature |
| `expanded.spec.ts`   | 40+   | ⚠️ Needs UI fixes | Full app coverage  |

### **Adding New Tests**

```typescript
// tests/e2e/your-test.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Your Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button:has-text("Family")');
  });

  test('should do something', async ({ page }) => {
    // Your test here
  });
});
```

---

## 🚀 **CI/CD Integration**

### **GitHub Actions Example**

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: ./scripts/run-e2e-tests.sh

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📚 **Resources**

- **Playwright Docs:** https://playwright.dev
- **Test Isolation:** https://playwright.dev/docs/test-parallel
- **Debugging:** https://playwright.dev/docs/debug
- **Docker Compose:** https://docs.docker.com/compose/

---

**Questions?** Check the troubleshooting section or view container logs!
