# Feishu Full Integration Plan

**Goal**: Feishu group chat should have 100% feature parity with Web UI - same backend, same features, same database.

---

## 🎯 **Architecture Principle**

```
┌─────────────────┐
│   Feishu App    │
│  (Mobile/Desktop)│
└────────┬────────┘
         │ WebSocket / HTTP
         ▼
┌─────────────────────────────────────┐
│     Agent Hub Backend (Port 4000)   │
│  ┌───────────────────────────────┐  │
│  │  MessageService.ts            │  │
│  │  - @mention handling          │  │
│  │  - Heat tracking              │  │
│  │  - Agent selection            │  │
│  │  - Discussion triggers        │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  OpenClawService.ts           │  │
│  │  - LLM generation             │  │
│  │  - Agent personas             │  │
│  └───────────────────────────────┘  │
└────────┬────────────────────────────┘
         │
         ├──────────────┐
         ▼              ▼
┌────────────────┐  ┌────────────────┐
│   Web UI       │  │   Feishu API   │
│ (localhost:3000)│  │ (Send Messages)│
└────────────────┘  └────────────────┘
```

**Key Principle**: Single backend, multiple clients. Feishu is NOT a separate system.

---

## 📋 **Current Status Audit**

### ✅ **Working (Web UI)**
- [x] Message sending/receiving
- [x] Agent responses (60% probability)
- [x] @mention targeting (100% priority)
- [x] Agent-to-agent @mentions
- [x] Discussion triggers (`/discuss [topic]`)
- [x] Heat-based engagement system
- [x] Message persistence (SQLite)
- [x] Real-time WebSocket
- [x] Agent avatars

### ⚠️ **Feishu Integration Status**
- [x] Feishu Official SDK installed (`@larksuiteoapi/node-sdk`)
- [x] WebSocket receiver (feishu-official.service.ts)
- [x] HTTP sender (Feishu API)
- [ ] **Integrated with MessageService.ts** ← BLOCKER
- [ ] **Configured credentials** ← BLOCKER
- [ ] **End-to-end testing** ← PENDING

---

## 🚧 **Blockers Identified**

### **Blocker #1: Separate Code Paths**
**Problem**: Feishu has its own message handling logic instead of using shared MessageService.ts

**Current Flow**:
```
Feishu → feishu-official.service.ts → [duplicate logic] → Agent response
Web UI → routes/messages.ts → MessageService.ts → Agent response
```

**Should Be**:
```
Feishu → routes/feishu-webhook.ts → MessageService.ts → Agent response
Web UI → routes/messages.ts → MessageService.ts → Agent response
```

### **Blocker #2: Missing Credentials**
**Problem**: Feishu app credentials not configured in `.env`

**Needed**:
- `FEISHU_APP_ID` (cli_xxx)
- `FEISHU_APP_SECRET`
- `FEISHU_VERIFY_TOKEN`
- `FEISHU_CHAT_ID` (group chat ID)

### **Blocker #3: Message Format Mismatch**
**Problem**: Feishu message format differs from Web UI format

**Feishu Format**: Rich text, mentions, images
**Web UI Format**: Plain text

**Solution**: Normalize Feishu messages to plain text before processing

---

## 📅 **Implementation Plan**

### **Phase 1: Unify Message Handling (Priority: P0)**
**Goal**: Feishu messages use same MessageService.ts as Web UI

**Tasks**:
1. Create `/server/src/routes/feishu-webhook.ts`
   - Parse Feishu webhook payload
   - Extract: `chatId`, `senderId`, `content`, `mentions`
   - Normalize to standard format: `{ roomId, senderType, content, agentId? }`
   - Call `MessageService.handleMessage()` (same as Web UI)

2. Update `feishu-official.service.ts`
   - Remove duplicate message handling logic
   - Keep only: WebSocket connection, message parsing, HTTP sending
   - Delegate to routes/feishu-webhook.ts

3. Create shared `MessageService.handleMessage()` method
   - Accept normalized message format
   - Handle: save to DB, heat tracking, agent selection, @mentions
   - Return: message object for delivery

**Deliverable**: Single code path for both clients

---

### **Phase 2: Configure Feishu Credentials (Priority: P0)**
**Goal**: Establish connection to Feishu group chat

**Tasks**:
1. Create Feishu app in Feishu Open Platform
   - App type: Internal (for family use)
   - Permissions: `im:message`, `im:chat`

2. Subscribe to events:
   - `im.message.receive_v1` (receive messages)
   - Mode: Persistent connection (WebSocket)

3. Add bot to family group chat
   - Bot must be group member to receive/send messages

4. Configure `.env`:
   ```bash
   FEISHU_APP_ID=cli_xxx
   FEISHU_APP_SECRET=xxx
   FEISHU_VERIFY_TOKEN=xxx
   FEISHU_CHAT_ID=oc_xxx
   ```

**Deliverable**: Feishu WebSocket connected, messages flowing

---

### **Phase 3: Feature Parity Testing (Priority: P1)**
**Goal**: Verify all Web UI features work in Feishu

**Test Cases**:
| Feature | Test Command | Expected Result |
|---------|-------------|-----------------|
| Basic response | "hello" | Agent responds (60% chance) |
| @mention | "@Mom 做饭吧" | Mom responds 100% |
| Multi-mention | "@Mom @Dad 吃饭了" | Both respond sequentially |
| Discussion | "/discuss 周末去哪玩" | 4-8 turns, 3s delays |
| Agent chain | "@Bro" → Bro responds with "@Mom" | Mom also responds |
| Heat system | Send 5 rapid messages | Multiple agents engage |

**Deliverable**: All features tested and working

---

### **Phase 4: Message Format Enhancement (Priority: P2)**
**Goal**: Support Feishu-specific features

**Tasks**:
1. Parse Feishu @mentions properly
   - Feishu format: `<at user_id="xxx">Mom</at>`
   - Convert to: `@Mom`

2. Support Feishu rich text
   - Images, links, formatting
   - Normalize to plain text for agent context

3. Format agent responses for Feishu
   - Add agent avatar emoji
   - Support Feishu message types (text, rich text)

**Deliverable**: Native Feishu experience

---

### **Phase 5: Deployment & Monitoring (Priority: P3)**
**Goal**: Production-ready Feishu integration

**Tasks**:
1. Deploy backend to always-on server
   - Keep WebSocket connected 24/7
   - Auto-reconnect on disconnect

2. Add logging & monitoring
   - Log all Feishu messages
   - Track response times
   - Alert on failures

3. Error handling
   - Graceful degradation if Feishu API fails
   - Retry logic for transient errors

**Deliverable**: Stable production integration

---

## 🎯 **Success Criteria**

| Criteria | Web UI | Feishu | Status |
|----------|--------|--------|--------|
| Message sending | ✅ | ❌ | Pending |
| Agent responses | ✅ | ❌ | Pending |
| @mention targeting | ✅ | ❌ | Pending |
| Discussion triggers | ✅ | ❌ | Pending |
| Agent-to-agent @mentions | ✅ | ❌ | Pending |
| Heat-based engagement | ✅ | ❌ | Pending |
| Message persistence | ✅ | ❌ | Pending |
| Real-time delivery | ✅ | ❌ | Pending |

**Definition of Done**: All ✅ for both columns

---

## 📊 **Timeline Estimate**

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Unify handling | 2-3 hours | None |
| Phase 2: Configure credentials | 1 hour | Feishu app approval |
| Phase 3: Feature testing | 2 hours | Phase 1+2 complete |
| Phase 4: Format enhancement | 3-4 hours | Phase 3 complete |
| Phase 5: Deployment | 1-2 hours | Phase 4 complete |

**Total**: 9-12 hours of development

---

## 🚀 **Next Steps**

1. **Immediate**: Start Phase 1 (unify message handling)
2. **Parallel**: Create Feishu app (Phase 2 prep)
3. **After Phase 1**: Test with mock Feishu payloads
4. **After Phase 2**: Full end-to-end testing

---

## 💡 **Key Insights**

1. **Don't duplicate logic**: MessageService.ts is the single source of truth
2. **Feishu is just a transport layer**: Same backend, different UI
3. **Normalize early**: Convert Feishu format to standard format immediately
4. **Test incrementally**: Verify each feature before moving to next

---

**Ready to start Phase 1?** I can begin unifying the message handling now.
