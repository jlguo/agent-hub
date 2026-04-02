# Integration Test Issue: ts-jest ES Module Limitations

## Problem Statement

Integration tests fail with TypeScript error:
```
error TS1343: The 'import.meta' meta-property is only allowed when the 
'--module' option is 'es2020', 'es2022', 'esnext', 'system', 'node16', 
'node18', 'node20', or 'nodenext'.
```

## Root Cause Analysis

### 1. Our Codebase Uses ES Modules
```typescript
// server/src/index.ts
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

### 2. ts-jest Configuration Conflict
```javascript
// server/jest.config.js
export default {
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'server/tsconfig.json',
      useESM: true,  // ← Enabled but has limitations
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
}
```

### 3. The Conflict
- ts-jest's `useESM: true` is experimental
- `import.meta.url` requires Node.js ESM loader
- Jest runs in its own VM context, not Node.js native ESM
- TypeScript compiler options don't fully translate to Jest runtime

## Error Reproduction

```bash
# Unit tests work fine (don't import index.ts)
npx jest --config=server/jest.config.js
# ✅ 63 tests passing

# Integration tests fail (import index.ts with import.meta)
npx jest --config=server/jest.config.js server/src/routes/__tests__/messages.test.ts
# ❌ TS1343 error on import.meta.url
```

## Solution Options

### Option A: Remove import.meta.url from index.ts ⭐ RECOMMENDED

**Change**: Use Node.js native `__dirname` instead
```typescript
// Before (ES module style)
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// After (Jest-compatible)
const __dirname = __dirname || path.dirname(fileURLToPath(import.meta.url));
// OR use require (CommonJS fallback)
const __dirname = path.dirname(__filename);
```

**Pros**:
- Simple fix (5 lines of code)
- No breaking changes
- Works with both Jest and production

**Cons**:
- Mixes CommonJS and ES module patterns
- TypeScript may warn about `__dirname` not existing in ES modules

---

### Option B: Separate Test Entry Point

**Change**: Create test-specific app export without import.meta
```typescript
// server/src/test-app.ts (for Jest only)
import express from 'express';
// ... app setup without dotenv loading
export const app = express();
```

**Pros**:
- Clean separation of concerns
- No changes to production code

**Cons**:
- Duplicate code
- Test environment differs from production
- Already attempted (module resolution issues)

---

### Option C: Switch ts-jest to @swc/jest ⭐ ALTERNATIVE

**Change**: Use SWC compiler instead of ts-jest
```javascript
// package.json
{
  "devDependencies": {
    "@swc/core": "^1.3.0",
    "@swc/jest": "^0.2.0"
  }
}

// jest.config.js
module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
}
```

**Pros**:
- Much faster (10-20x speedup)
- Better ES module support
- Actively maintained

**Cons**:
- New dependency
- Slightly different behavior than TypeScript
- May need configuration tuning

---

### Option D: Use Node.js Native Test Runner

**Change**: Switch from Jest to Node.js native test runner
```typescript
// Node 18+ native test runner
import { test } from 'node:test';
import { describe } from 'node:test';

test('API endpoint', async () => {
  // test code
});
```

**Pros**:
- No configuration needed
- Native ES module support
- Built into Node.js

**Cons**:
- Different API than Jest
- Less mature ecosystem
- Migration effort for existing tests

---

### Option E: Dynamic import() for index.ts

**Change**: Use dynamic import in tests
```typescript
// In test file
const { app } = await import('../../index.js');
```

**Pros**:
- No changes to production code

**Cons**:
- Async imports complicate test setup
- Still may hit ESM loader issues

---

## Recommended Solution: Option A + C

### Phase 1: Quick Fix (Option A)
1. Update index.ts to handle both Jest and production
2. Run integration tests immediately
3. Minimal code changes

### Phase 2: Performance Upgrade (Option C)
1. Install @swc/jest
2. Update Jest config
3. Benchmark performance
4. Keep as permanent solution

---

## Implementation: Option A

```typescript
// server/src/index.ts
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Jest-compatible __dirname handling
const getDirname = () => {
  // Check if running in Jest (CommonJS context)
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // ES module context (production)
  return path.dirname(fileURLToPath(import.meta.url));
};

const __dirname = getDirname();
config({ path: path.resolve(__dirname, '../../.env') });
```

**Wait - this won't work!** `__dirname` is not defined in ES modules, so the check fails.

### Correct Implementation:

```typescript
// server/src/index.ts
import path from 'path';
import { config } from 'dotenv';

// Use process.cwd() for Jest, import.meta for production
const loadEnv = () => {
  try {
    // Try ES module approach first
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    config({ path: path.resolve(__dirname, '../../.env') });
  } catch {
    // Fallback for Jest (uses process.cwd())
    config({ path: path.resolve(process.cwd(), '.env') });
  }
};

loadEnv();
```

---

## Decision Required

Which approach should we take?

1. **Option A**: Quick fix to index.ts (10 minutes)
2. **Option C**: Switch to @swc/jest (30 minutes)
3. **Both**: Fix now + optimize later (40 minutes total)
4. **Defer**: Accept current limitation, focus on other work

**My Recommendation**: Option A (quick fix) + Option C (performance upgrade)
- Get integration tests working now
- Improve performance as bonus
- Total time: <1 hour
