# CLI + Webhook Implementation Summary

**Date:** 2026-03-27  
**Status:** ✅ Complete  
**Architecture Alignment:** Aligned with AGENT-HUB-ARCHITECTURE.md v2.0

---

## Changes Made

### 1. OpenClawService.ts - Replaced WebSocket with CLI

**File:** `server/src/services/OpenClawService.ts`

**Before:**
- WebSocket connection to OpenClaw Gateway
- JSON-RPC message format
- Session management with persistent connections
- Challenge-response authentication

**After:**
- CLI-based integration via `child_process.exec`
- Command: `openclaw agent --message "text" --agent "name" --session "id"`
- Stateless (no persistent sessions)
- Direct stdout capture for AI responses

**Key Methods:**
```typescript
sendMessage(message, agentName, sessionId, context?): Promise<OpenClawResponse>
checkSessionHealth(sessionId): Promise<{healthy: boolean}>
getAllSessions(): Array<...>
cleanupExpiredSessions(): Promise<string[]>
```

---

### 2. Webhook Authentication Middleware

**File:** `server/src/middleware/webhookAuth.ts`

**Purpose:** Verify OpenClaw webhook tokens

**Implementation:**
- Checks header: `x-openclaw-token`
- Compares with env: `OPENCLAW_VERIFICATION_TOKEN`
- Returns 401 if token missing or invalid
- Returns 500 if token not configured on server

---

### 3. Webhook Route Handler

**File:** `server/src/routes/webhooks.ts`

**Endpoint:** `POST /api/webhooks/openclaw`

**Flow:**
1. Verify webhook token (middleware)
2. Validate payload structure
3. Save message to database (Prisma)
4. Emit WebSocket event to frontend (`message:new`)
5. Trigger agent response (async, non-blocking)
6. Return acknowledgment (200 OK)

**Payload Format:**
```json
{
  "channel": "feishu",
  "accountId": "architect",
  "chatId": "oc_family_room",
  "message": {
    "id": "msg_123",
    "content": "Hello",
    "sender": {
      "id": "user_456",
      "name": "John Doe"
    },
    "timestamp": "2026-03-27T13:56:00Z"
  }
}
```

**Additional Endpoint:**
- `GET /api/webhooks/health` - Health check for monitoring

---

### 4. MessageService - Centralized Agent Response Logic

**File:** `server/src/services/MessageService.ts`

**Purpose:** Shared service for triggering agent responses

**Used By:**
- `POST /api/messages/rooms/:roomId` (REST API)
- `POST /api/webhooks/openclaw` (Webhook)

**Flow:**
1. Query agents in room
2. Select responding agent (random for MVP)
3. Build agent context (personality, relationships, room context)
4. Call OpenClawService.sendMessage()
5. Save AI response to database
6. Emit WebSocket event to frontend

---

### 5. Socket.io Library

**File:** `server/src/lib/socket.ts`

**Purpose:** Centralized Socket.io instance management

**Methods:**
- `initializeIO(server)` - Initialize Socket.io on HTTP server
- `getIO()` - Get Socket.io instance (throws if not initialized)

---

### 6. Server Index Updates

**File:** `server/src/index.ts`

**Changes:**
- Import webhook router
- Mount webhook route: `app.use('/api/webhooks', webhookRouter)`
- Use socket lib: `initializeIO(httpServer)`

---

### 7. Environment Configuration

**Files:** `.env`, `.env.example`

**New Variables:**
```bash
# Webhook Authentication
OPENCLAW_VERIFICATION_TOKEN=your-secret-token-change-this

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Session Configuration
SESSION_MAX_AGE=3600000  # 1 hour
SESSION_CHECK_INTERVAL=30000  # 30 seconds
```

**Removed Variables:**
- `OPENCLAW_GATEWAY_URL` (no longer needed for WebSocket)
- `OPENCLAW_GATEWAY_TOKEN` (replaced with webhook token)

---

## OpenClaw Configuration Required

To enable webhook integration, configure OpenClaw Gateway:

### Option 1: Via OpenClaw Config File

```json
{
  "channels": {
    "feishu": {
      "connectionMode": "webhook",
      "webhookPath": "/api/webhooks/openclaw",
      "webhookHost": "localhost",
      "webhookPort": 4000,
      "verificationToken": "agent-hub-demo-token-2026"
    }
  }
}
```

### Option 2: Via OpenClaw CLI (if supported)

```bash
openclaw config set channels.feishu.connectionMode webhook
openclaw config set channels.feishu.webhookPath /api/webhooks/openclaw
openclaw config set channels.feishu.webhookHost localhost
openclaw config set channels.feishu.webhookPort 4000
openclaw config set channels.feishu.verificationToken agent-hub-demo-token-2026
```

---

## Testing Checklist

### 1. Server Startup

```bash
cd ~/agent-hub
npm run dev:server
```

**Expected Output:**
```
╔════════════════════════════════════════════════╗
║           Agent Hub Server Started             ║
╠════════════════════════════════════════════════╣
║  HTTP:    http://0.0.0.0:4000                  ║
║  Health:  http://0.0.0.0:4000/health           ║
║  WebSocket: ws://0.0.0.0:4000                  ║
╚════════════════════════════════════════════════╝

✓ Session Guardian started
```

### 2. Health Check

```bash
curl http://localhost:4000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-27T06:00:00.000Z",
  "uptime": 123.456
}
```

### 3. Webhook Health

```bash
curl http://localhost:4000/api/webhooks/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "endpoint": "/api/webhooks/openclaw",
  "timestamp": "2026-03-27T06:00:00.000Z"
}
```

### 4. Test Webhook (Manual)

```bash
curl -X POST http://localhost:4000/api/webhooks/openclaw \
  -H "Content-Type: application/json" \
  -H "x-openclaw-token: agent-hub-demo-token-2026" \
  -d '{
    "channel": "feishu",
    "accountId": "architect",
    "chatId": "family-room-demo",
    "message": {
      "id": "test_123",
      "content": "Test message from webhook",
      "sender": {
        "id": "user_test",
        "name": "Test User"
      },
      "timestamp": "2026-03-27T06:00:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "ok",
  "messageId": "cmr_xxx",
  "timestamp": "2026-03-27T06:00:00.000Z"
}
```

**Expected Server Logs:**
```
[Webhook Auth] ✅ Token verified successfully
[Webhook] Received message from OpenClaw: { channel: 'feishu', ... }
[Webhook] ✅ Message saved to DB: cmr_xxx
[Webhook] 📡 Emitted message:new to room family-room-demo
[MessageService] Triggering agent response for room family-room-demo
[MessageService] Selected agent: Mom
[OpenClaw CLI] Executing: openclaw agent --message "..." --agent "Mom" --session "..."
[MessageService] AI response received (xxx chars)
[MessageService] ✅ Agent Mom responded successfully
```

### 5. Test CLI Integration

```bash
openclaw agent --message "Hello" --agent "Mom" --session "family-room-demo"
```

**Expected Output:**
```
AI response text from Mom
```

---

## Architecture Alignment

| Architecture Decision | Implementation | Status |
|----------------------|----------------|--------|
| Webhook (inbound) | `/api/webhooks/openclaw` | ✅ Implemented |
| CLI (outbound) | `OpenClawService.sendMessage()` | ✅ Implemented |
| Token authentication | `webhookAuth.ts` middleware | ✅ Implemented |
| Stateless sessions | Removed WebSocket session management | ✅ Implemented |
| Async agent responses | Non-blocking `triggerAgentResponse()` | ✅ Implemented |
| WebSocket to frontend | Socket.io `message:new` events | ✅ Maintained |
| Session Guardian | Stub methods for compatibility | ✅ Maintained |

---

## Next Steps

1. **Restart Server** - Apply changes
2. **Configure OpenClaw Webhook** - Set webhook URL and token
3. **Test End-to-End Flow** - Send message via Feishu → OpenClaw → Webhook → Agent Hub → CLI → OpenClaw → Feishu
4. **Monitor Logs** - Watch for errors in webhook processing or CLI execution
5. **Update Frontend** - Ensure frontend connects to WebSocket and displays messages

---

## Rollback Plan

If issues occur, revert to WebSocket-based integration:

```bash
# Git revert (if using version control)
git checkout HEAD~1 -- server/src/services/OpenClawService.ts
git checkout HEAD~1 -- server/src/routes/webhooks.ts

# Or restore from backup
cp server/src/services/OpenClawService.ts.backup server/src/services/OpenClawService.ts
```

Reinstall WebSocket dependencies:
```bash
npm install ws @types/ws
```

Update `.env`:
```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
```

---

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `server/src/services/OpenClawService.ts` | ~350 | Rewrite |
| `server/src/middleware/webhookAuth.ts` | +50 | New |
| `server/src/routes/webhooks.ts` | +120 | New |
| `server/src/services/MessageService.ts` | +100 | New |
| `server/src/lib/socket.ts` | +30 | New |
| `server/src/index.ts` | ~20 | Update |
| `server/src/routes/messages.ts` | ~80 | Update |
| `.env.example` | ~30 | Update |
| `.env` | ~15 | Update |

**Total:** ~895 lines changed/added

---

## Questions or Issues?

Refer to:
- **Architecture Doc:** `~/agent-hub/ARCHITECTURE.md` (Section 8: Integration Architecture)
- **Quick Reference:** `~/agent-hub/QUICK-REFERENCE.md`
- **OpenClaw Docs:** https://docs.openclaw.ai
