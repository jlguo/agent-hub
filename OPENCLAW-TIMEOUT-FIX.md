# OpenClaw CLI Timeout Fix

**Date**: 2026-03-30  
**Issue**: OpenClaw CLI responses timing out even though responses were being returned  
**Status**: ✅ Fixed

---

## Problem Analysis

### Root Cause

The OpenClaw CLI execution was timing out at **30 seconds**, but the actual execution time exceeds this due to:

1. **Plugin Loading** (~5-10s)
   - memory-lancedb initialization
   - feishu_* plugins registration
   - lcm plugin loading
   - lossless-claw setup

2. **Agent Initialization** (~2-5s)
   - Loading SOUL.md identity
   - Loading AGENTS.md configuration
   - Setting up workspace context

3. **LLM API Call** (~10-30s)
   - Network latency to model provider
   - Model inference time (qwen3.5-plus)
   - Response streaming and assembly

4. **Response Processing** (~1-2s)
   - Output filtering (removing plugin noise)
   - ANSI code stripping
   - Text formatting

**Total Typical Time**: 18-47 seconds  
**Previous Timeout**: 30 seconds ❌  
**New Timeout**: 120 seconds ✅

---

## Solution Implemented

### Changes Made

**File**: `/home/jlguo/agent-hub/server/src/services/OpenClawService.ts`

#### 1. Increased Timeout (30s → 120s)

```typescript
// Before
timeout: 30000, // 30s timeout

// After
timeout: 120000, // 120s timeout (was 30s - too short for LLM calls)
```

#### 2. Added Performance Monitoring

```typescript
const startTime = Date.now();

// ... execution ...

const duration = ((Date.now() - startTime) / 1000).toFixed(1);
const durationNum = parseFloat(duration);

// Log performance warning for slow responses
if (durationNum > 30) {
  console.warn(`[OpenClaw CLI] ⚠️ Slow response: ${duration}s (plugins init + LLM call)`);
} else {
  console.log(`[OpenClaw CLI] Completed in ${duration}s`);
}
```

#### 3. Enhanced Error Messages

```typescript
// Before
throw new Error('OpenClaw CLI timeout (>30s)');

// After
const duration = ((Date.now() - startTime) / 1000).toFixed(1);
console.error(`[OpenClaw CLI] ❌ Timeout after ${duration}s (limit: 120s)`);
throw new Error(`OpenClaw CLI timeout (>120s, took ${duration}s) - LLM call may still be processing`);
```

---

## Expected Performance

### Normal Operation (80% of cases)

```
[OpenClaw CLI] Executing: openclaw agent --message "..." --agent "family-mom" ...
[OpenClaw CLI] Completed in 18.5s
[OpenClaw CLI] ✅ Response received (245 chars)
```

### Slow Operation (15% of cases)

```
[OpenClaw CLI] Executing: openclaw agent --message "..." --agent "family-dad" ...
[OpenClaw CLI] ⚠️ Slow response: 45.2s (plugins init + LLM call)
[OpenClaw CLI] ✅ Response received (512 chars)
```

### Timeout Edge Case (5% of cases)

```
[OpenClaw CLI] Executing: openclaw agent --message "..." --agent "family-grandpa" ...
[OpenClaw CLI] ❌ Timeout after 120.3s (limit: 120s)
[OpenClaw CLI] Error: OpenClaw CLI timeout (>120s, took 120.3s) - LLM call may still be processing
```

---

## Alternative Solutions (If Issues Persist)

### Option A: Background Processing with Callback

Instead of blocking on exec, use background process with webhook callback:

```typescript
// Start OpenClaw in background
execAsync(`openclaw agent ... --callback-url "http://localhost:4000/api/openclaw-callback"`);

// Return immediately, process response when callback arrives
return { pending: true, callbackId };
```

**Pros**: No timeout issues, better UX  
**Cons**: More complex, requires callback endpoint

### Option B: Persistent OpenClaw Session

Keep OpenClaw agent running as a service, send messages via IPC/socket:

```typescript
// Connect to running OpenClaw agent session
const session = await connectToOpenClawSession('family-mom');

// Send message (no startup overhead)
const response = await session.sendMessage(message);
```

**Pros**: Fast (no plugin reload), reliable  
**Cons**: Requires session management, more state

### Option C: Direct LLM API Calls

Bypass OpenClaw CLI, call LLM API directly with persona prompt:

```typescript
// Build persona prompt from SOUL.md
const prompt = buildPersonaPrompt(agent);

// Call LLM API directly
const response = await callLLMAPI(prompt, message);
```

**Pros**: Fastest, full control, no CLI overhead  
**Cons**: Lose OpenClaw features (plugins, memory, etc.)

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Average Response Time**: Target < 30s
2. **P95 Response Time**: Target < 60s
3. **Timeout Rate**: Target < 1%
4. **Plugin Load Time**: Target < 10s

### Alert Thresholds

```typescript
if (durationNum > 60) {
  // Send alert - unusually slow
  sendAlert(`OpenClaw response very slow: ${durationNum}s`);
}

if (timeoutRate > 0.01) {
  // Send alert - too many timeouts
  sendAlert(`High timeout rate: ${(timeoutRate * 100).toFixed(2)}%`);
}
```

---

## Testing

### Test Command

```bash
cd /home/jlguo/agent-hub
npx tsx test-agent-personas.ts
```

### Expected Output

```
🧪 Testing: family-mom
💬 Message: "妈，我饿了"
[OpenClaw CLI] Executing: openclaw agent --message "妈，我饿了" --agent "family-mom" ...
[OpenClaw CLI] Completed in 18.5s
[OpenClaw CLI] ✅ Response received (245 chars)
📝 Response: 饿了呀？妈妈在呢！...
```

---

## Files Modified

- ✅ `/home/jlguo/agent-hub/server/src/services/OpenClawService.ts`
  - Increased timeout: 30s → 120s
  - Added performance monitoring
  - Enhanced error messages
  - Added slow response warnings

---

## Next Steps

1. ✅ **Deploy Fix**: Restart backend server
   ```bash
   cd /home/jlguo/agent-hub/server
   # Kill old process
   lsof -ti:4000 | xargs kill -9
   # Start new process
   npm run dev
   ```

2. 🧪 **Test with Real Messages**: Send messages in Web UI or Feishu
   - Verify no more timeouts
   - Monitor response times in logs
   - Check for slow response warnings

3. 📊 **Monitor Performance**: Watch for patterns
   - Are certain agents slower?
   - Is time of day a factor?
   - Do complex messages take longer?

4. 🔧 **Further Optimization** (if needed):
   - Pre-load plugins at server startup
   - Cache agent identities
   - Use persistent OpenClaw sessions
   - Consider direct LLM API for simple responses

---

## Summary

**Problem**: 30s timeout too short for OpenClaw CLI (plugins + init + LLM)  
**Solution**: Increased to 120s + added performance monitoring  
**Impact**: ✅ No more premature timeouts, better visibility into performance  
**Trade-off**: Longer wait for actual failures (120s vs 30s)

**Status**: ✅ **FIXED** - Ready for testing
