# E2E Testing Guide

**Last Updated:** 2026-04-08  
**Test Environment:** ✅ Uses existing dev setup (simple & reliable)

---

## 🎯 **Quick Start**

### **Run All E2E Tests**

```bash
cd /home/jlguo/agent-hub
npx playwright test tests/e2e/ --reporter=list
```

**Prerequisites:**

- Dev containers must be running (`./start.sh` or `docker-compose up -d`)
- Frontend accessible at http://localhost:3000
- Backend accessible at http://localhost:4000

### **Run Specific Tests**

```bash
# Discussion tests (2 tests)
npx playwright test tests/e2e/discussion.spec.ts --reporter=list

# Expanded tests (40+ tests)
npx playwright test tests/e2e/expanded.spec.ts --reporter=list

# With HTML report
npx playwright test tests/e2e/discussion.spec.ts --reporter=html
npx playwright show-report

# Debug with visible browser
npx playwright test tests/e2e/discussion.spec.ts --headed
```

---

## 📋 **Test Suite Overview**

| Test File            | Tests | Status             | Purpose                             |
| -------------------- | ----- | ------------------ | ----------------------------------- |
| `discussion.spec.ts` | 2     | ✅ Fixed           | Discussion feature with heat system |
| `expanded.spec.ts`   | 40+   | ⚠️ UI fixes needed | Full app coverage                   |

---

## 🔧 **Test Configuration**

### **Heat System Handling**

Tests now properly handle the probabilistic heat system:

```typescript
// Before /discuss command, build heat first
for (let i = 0; i < 10; i++) {
  await page.locator('textarea').fill(`Message ${i + 1}`);
  await page.locator('button:has-text("Send")').click();
  await page.waitForTimeout(500);
}

// Now heat is in HOT zone (80%+ response rate)
await page.locator('textarea').fill('/discuss 周末去哪里玩');
await page.locator('button:has-text("Send")').click();
```

### **Timeouts**

- Default test timeout: 90 seconds
- Discussion tests: Extended waits for agent responses
- Retry count: 2 retries for flaky tests

---

## 🐛 **Debugging Tests**

### **View Test Output**

```bash
# List reporter (detailed)
npx playwright test tests/e2e/discussion.spec.ts --reporter=list

# Line reporter (minimal)
npx playwright test tests/e2e/discussion.spec.ts --reporter=line

# With debug logs
DEBUG=pw:api npx playwright test tests/e2e/discussion.spec.ts
```

### **Interactive Debugging**

```bash
# UI mode (best for debugging)
npx playwright test tests/e2e/discussion.spec.ts --ui

# Headed mode (visible browser)
npx playwright test tests/e2e/discussion.spec.ts --headed

# Slow down execution
npx playwright test tests/e2e/discussion.spec.ts --slowmo=1000
```

### **HTML Report**

```bash
# Generate report
npx playwright test tests/e2e/ --reporter=html

# Open in browser
npx playwright show-report
```

**Features:**

- Test results with screenshots
- Execution traces
- Console logs
- Video recordings

---

## 🎯 **Manual Verification**

To manually verify the feature works (not automated test):

### **Step 1: Open App**

```
http://localhost:3000
```

### **Step 2: Build Heat**

Send 10 messages quickly:

```
Message 1
Message 2
...
Message 10
```

### **Step 3: Trigger Discussion**

Type:

```
/discuss 周末去哪里玩
```

### **Step 4: Wait 30 Seconds**

Watch for:

- ✅ Purple "Discussion Started" banner
- ✅ 3-5 agent responses (white bubbles with avatars)
- ✅ Purple "Discussion Ended" banner

---

## 🔍 **Troubleshooting**

### **Problem: Tests Timeout**

**Cause:** Agent responses take longer than expected

**Solution:**

```bash
# Increase timeout
npx playwright test tests/e2e/discussion.spec.ts --timeout=120000

# Or edit test file:
test.setTimeout(120000);
```

### **Problem: Discussion Doesn't Start**

**Cause:** Heat level too low

**Solution:**

- Tests now build heat before /discuss (10 messages)
- Wait for heat to reach HOT zone (80%+ response rate)
- Check backend logs for heat tracking

### **Problem: Elements Not Found**

**Cause:** UI selectors changed or page not loaded

**Solution:**

```bash
# Run with visible browser to see what's happening
npx playwright test tests/e2e/discussion.spec.ts --headed

# Check if dev servers are running
docker-compose ps

# Check frontend logs
docker-compose logs frontend-1
```

### **Problem: Connection Refused**

**Cause:** Dev servers not running

**Solution:**

```bash
# Start dev environment
cd /home/jlguo/agent-hub
./start.sh

# Or with Docker
docker-compose up -d

# Verify servers are running
curl http://localhost:4000/health
curl http://localhost:3000
```

---

## 📊 **Test Results**

### **Expected Output**

```
Running 4 tests using 2 workers

  ✅  [chromium] › tests/e2e/discussion.spec.ts:19:3 › should trigger discussion (45.2s)
  ✅  [chromium] › tests/e2e/discussion.spec.ts:120:3 › should show system messages (12.8s)
  ✅  [webkit] › tests/e2e/discussion.spec.ts:19:3 › should trigger discussion (48.1s)
  ✅  [webkit] › tests/e2e/discussion.spec.ts:120:3 › should show system messages (13.2s)

  4 passed (120.5s)
```

### **Test Metrics**

- **Execution Time:** ~2 minutes for all tests
- **Pass Rate:** Target 100%
- **Flakiness:** <5% (with heat building fix)

---

## 🚀 **Best Practices**

### **Before Running Tests**

1. ✅ Ensure dev containers are healthy
2. ✅ Close browsers on ports 3000/4000
3. ✅ Have 5 minutes for test execution

### **During Test Development**

1. ✅ Use `--ui` mode for debugging
2. ✅ Use `--headed` to see browser
3. ✅ Add screenshots for debugging
4. ✅ Build heat before discussion triggers

### **After Tests**

1. ✅ Review HTML report for details
2. ✅ Check test-results/ for error contexts
3. ✅ Commit passing tests

---

## 📚 **Resources**

- **Playwright Docs:** https://playwright.dev
- **Test Isolation:** https://playwright.dev/docs/test-parallel
- **Debugging:** https://playwright.dev/docs/debug
- **Assertions:** https://playwright.dev/docs/test-assertions

---

**Questions?** Check troubleshooting section or run with `--ui` mode!
