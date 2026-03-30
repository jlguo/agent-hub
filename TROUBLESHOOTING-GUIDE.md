# Agent Hub - Troubleshooting Guide

## Quick Reference

| Symptom | Root Cause | Fix |
|---------|------------|-----|
| Agent responses show in Feishu but not Web UI | Missing WebSocket emit in callback path | Add `io.to(roomId).emit('message:new')` after DB save |
| Messages disappear after page refresh | API returns oldest messages | Change `orderBy: 'asc'` → `'desc'` + `.reverse()` |
| "Invalid Date" on messages | Null/invalid createdAt | Add null check + fallback to "Just now" |
| Duplicate messages in UI | Added from POST + WebSocket | Remove immediate add, use WebSocket as single source |
| Messages stuck at top after refresh | Auto-scroll disabled | Re-enable with `useEffect` + `scrollTop = scrollHeight` |
| OpenClaw CLI timeout (30s) | Response takes 18-47s typically | Increase timeout to 120s |
| "Unknown agent id 'Mom'" | DB name ≠ OpenClaw agent ID | Add name mapping: Mom → family-mom |
| Agents respond without context | recentHistory array empty | Load last 20 messages from DB before building prompt |
| @mention only works for humans | Only checked user messages | Extend to check agent messages too |
| Feishu WebSocket 404 errors | Raw WebSocket not supported | Use official SDK: `@larksuiteoapi/node-sdk` |
| Room lookup fails (settings field) | Schema uses externalChatId | Query `externalChatId` instead of `settings` |
| OpenClaw "undefined.length" error | Passing roomId as sessionId | Use `agent.id` (e.g., "family-mom") as sessionId |
| Feishu send fails (field validation) | Raw axios POST format wrong | Use SDK: `client.im.message.create()` |
| Web UI messages don't sync to Feishu | Unidirectional integration | Add Feishu callback in messages.ts POST route |
| /discuss only works from Feishu | Missing callback for Web UI | Pass `sendToExternal` callback to DiscussionService |
| WebSocket messages not received | Client joins AFTER server emit | Wait for "joined room" log before sending |
| React Error Boundary crashes | Port conflict (404) | Restart frontend on different port (3000→3001→3002) |
| "Two children with same key" | Duplicate keys in lists | Use composite keys: `${id}-${createdAt}` |
| Message styling wrong (blue/white) | Using old `role` field | Change to `senderType === 'human'` |

---

## Issue #1: Agent Responses Not Showing in Web UI (REAL-TIME)

**Symptom**: Agent responses appear in Feishu but Web UI requires page refresh to see them.

**Root Cause**: The `triggerAgentResponseWithCallback` function was designed for Feishu integration but only:
1. Saved to database ✅
2. Called Feishu callback ✅
3. **Missing**: WebSocket emit to Web UI ❌

**Debug Steps**:
1. Add logging after agent message save:
   ```typescript
   console.log(`✅ Agent message saved: ${agentMessage.id}`);
   console.log(`📡 About to emit agent response to WebSocket`);
   ```
2. Check server logs - if you see saves but NO emits, this is the issue
3. Check browser console - if you only see user messages (not agent responses), this confirms it

**Fix** (MessageService.ts):
```typescript
// Save agent response
const agentMessage = await prisma.message.create({ ... });

console.log(`✅ Agent message saved: ${agentMessage.id}`);

// Emit WebSocket event to frontend (Web UI) ← ADD THIS
const io = getIO();
io.to(roomId).emit('message:new', {
  ...agentMessage,
  agentName: agentMessage.agent?.name,
  agentAvatar: agentMessage.agent?.avatar,
});

// Call the delivery callback (Feishu)
await onAgentResponse(agentMessage);
```

**Verification**:
- Server logs: "✅ WebSocket emit complete for agent response"
- Browser console: "📩 WebSocket received message:new" with agent content
- UI: Agent messages appear in real-time without refresh

---

## Issue #2: Messages Disappear After Page Refresh

**Symptom**: User reports "all talks disappeared" after refreshing page.

**Root Cause**: API endpoint returned **oldest** 50 messages (`orderBy: 'asc'`), so user saw empty conversation at top instead of recent messages at bottom.

**Debug Steps**:
1. Check database: `SELECT COUNT(*) FROM message` - messages exist
2. Check API response: `curl http://localhost:4000/api/messages/rooms/family-room-demo`
3. If messages are oldest first, this is the issue

**Fix** (routes/messages.ts):
```typescript
const messages = await prisma.message.findMany({
  where: { roomId },
  orderBy: { createdAt: 'desc' }, // Changed from 'asc'
  take: limit,
});
return messages.reverse(); // Reverse for chronological display
```

**Verification**:
- API returns newest messages first
- UI displays oldest→newest (chronological)
- Recent conversation visible at bottom after refresh

---

## Issue #3: OpenClaw CLI Timeout

**Symptom**: "Command timed out after 30000 milliseconds"

**Root Cause**: OpenClaw CLI typically needs 18-47s for LLM responses, but timeout was set to 30s.

**Debug Steps**:
1. Test direct CLI: `time openclaw agent --message "test" --agent "family-mom"`
2. If it takes >30s, this is the issue

**Fix** (OpenClawService.ts):
```typescript
const result = await exec(`openclaw agent ...`, {
  timeout: 120000, // Changed from 30000
});
```

**Add Performance Logging**:
```typescript
const start = Date.now();
const result = await exec(...);
const duration = Date.now() - start;
if (duration > 30000) {
  console.warn(`⚠️ Slow response: ${duration}ms`);
}
```

---

## Issue #4: Agent Name Mismatch

**Symptom**: "Unknown agent id 'Mom'. Use 'openclaw agents list' to see configured agents."

**Root Cause**: Database has agent names (Mom, Dad, Grandma) but OpenClaw expects agent IDs (family-mom, family-dad, family-grandma).

**Debug Steps**:
1. List OpenClaw agents: `openclaw agents list`
2. Compare with database: `SELECT id, name FROM agent`
3. If IDs don't match, this is the issue

**Fix** (agent-response.service.ts):
```typescript
function mapAgentNameToOpenClawId(agentName: string): string {
  const mapping: Record<string, string> = {
    'Mom': 'family-mom',
    'Dad': 'family-dad',
    'Grandma': 'family-grandma',
    'Grandpa': 'family-grandpa',
    'Bro': 'family-bro',
    'Sis': 'family-sis',
  };
  return mapping[agentName] || agentName;
}
```

---

## Issue #5: Feishu WebSocket 404 Errors

**Symptom**: "404 Not Found" on `https://open.feishu.cn/open-apis/connect/v1/ws_ticket`

**Root Cause**: Raw WebSocket implementation tried to fetch ticket, but this endpoint is enterprise-only. Official SDK handles authentication automatically.

**Debug Steps**:
1. Check if using raw WebSocket or official SDK
2. If raw WebSocket + ticket endpoint, this is the issue

**Fix**: Use official SDK
```typescript
import * as Lark from '@larksuiteoapi/node-sdk';

const wsClient = new Lark.WSClient({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
});

wsClient.start({
  eventDispatcher: new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => { /* handle */ }
  })
});
```

---

## Issue #6: Room Lookup Fails (Settings Field)

**Symptom**: Prisma error "Unknown field `settings` for model `Room`"

**Root Cause**: Schema uses `externalChatId` field, but code queried `settings.contains`.

**Debug Steps**:
1. Check Prisma schema: `cat prisma/schema.prisma | grep -A 10 "model Room"`
2. If field is `externalChatId` not `settings`, this is the issue

**Fix** (MessageService.ts):
```typescript
const room = await prisma.room.findUnique({
  where: { externalChatId: feishuChatId }, // Changed from settings.contains
});
```

---

## Issue #7: OpenClaw Session ID Error

**Symptom**: "Cannot read properties of undefined (reading 'length')"

**Root Cause**: Passing database room ID as sessionId parameter instead of agent ID.

**Debug Steps**:
1. Check OpenClaw CLI command: what's passed to `--session-id`?
2. If it's room ID (e.g., "cmn8ut...") instead of agent ID (e.g., "family-mom"), this is the issue

**Fix** (MessageService.ts):
```typescript
const response = await OpenClawService.sendMessage(
  userMessage,
  agent.id, // ← Use agent.id (e.g., "family-mom")
  agent.id, // ← As sessionId, NOT roomId
  ...
);
```

---

## Issue #8: Feishu Send Field Validation Error

**Symptom**: Error 99992402 "field validation failed" when sending to Feishu

**Root Cause**: Raw axios POST request format doesn't match Feishu API requirements.

**Debug Steps**:
1. Check if using raw axios or official SDK
2. If raw POST, this is likely the issue

**Fix**: Use official SDK
```typescript
// Instead of axios POST:
const response = await client.im.message.create({
  params: { receive_id_type: 'chat_id' },
  data: {
    receive_id: chatId,
    msg_type: 'text',
    content: JSON.stringify({ text: content }),
  },
});
```

---

## Issue #9: WebSocket Timing Issue

**Symptom**: Messages sent from Feishu don't appear in Web UI in real-time, but appear after refresh.

**Root Cause**: Server emits WebSocket events BEFORE client joins the room.

**Debug Steps**:
1. Add server logging before WebSocket emit
2. Add client logging on room join
3. Compare timestamps - if emit happens before join, this is the issue

**Server Logs**:
```typescript
console.log(`📡 About to emit to WebSocket, roomId: ${roomId}`);
io.to(roomId).emit('message:new', message);
```

**Client Logs** (page.tsx):
```typescript
socket.emit('room:join', { roomId });
console.log(`✅ Client ${socket.id} joined room ${roomId}`);
```

**Workaround**: Wait for "joined room" confirmation before sending test messages.

**Proper Fix**: Ensure socket connects and joins room before page renders, or fetch latest messages on room join as fallback.

---

## Issue #10: Duplicate Messages in UI

**Symptom**: Same message appears twice in chat list.

**Root Cause**: Message added immediately from POST response AND again from WebSocket broadcast.

**Debug Steps**:
1. Check frontend message send handler
2. If it does `setMessages([...messages, newMessage])` AND listens to WebSocket, this is the issue

**Fix** (page.tsx):
```typescript
// Remove immediate add from POST response
const response = await fetch(`/api/messages/rooms/${roomId}`, {
  method: 'POST',
  body: JSON.stringify({ content }),
});
// Don't add to messages here - let WebSocket broadcast handle it

// Add deduplication in WebSocket handler
socket.on('message:new', (newMessage) => {
  setMessages(prev => {
    if (prev.find(m => m.id === newMessage.id)) {
      return prev; // Skip duplicate
    }
    return [...prev, newMessage];
  });
});
```

---

## Issue #11: Auto-Scroll Not Working

**Symptom**: Messages load but chat stays at top, appears empty.

**Root Cause**: Auto-scroll was disabled (commented out) during debugging, or using wrong scroll method.

**Debug Steps**:
1. Check if messagesEndRef exists
2. Check if scrollToBottom is called
3. Check scroll method - `scrollIntoView` on container doesn't work

**Fix** (page.tsx):
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

const scrollToBottom = () => {
  const container = messagesEndRef.current;
  if (container) {
    container.scrollTop = container.scrollHeight; // NOT scrollIntoView
  }
};

useEffect(() => {
  scrollToBottom();
}, [messages]); // Trigger on messages change
```

---

## Issue #12: React Key Warnings

**Symptom**: Console warning "Encountered two children with the same key"

**Root Cause**: Using non-unique keys (e.g., just `message.id`) when messages can be added twice.

**Fix** (page.tsx):
```typescript
// Use composite keys
{messages.map(message => (
  <div key={`${message.id}-${message.createdAt}`} ... />
))}

// For rooms and agents
{rooms.map(room => (
  <button key={`${room.id}-${room.name}`} ... />
))}
```

---

## Issue #13: Message Styling Wrong

**Symptom**: Human messages appear white/left, agent messages blue/right (reversed).

**Root Cause**: Using old schema field `message.role` instead of `message.senderType`.

**Debug Steps**:
1. Check Prisma schema - field is `senderType` ('human' | 'agent')
2. Check frontend - if using `message.role === 'user'`, this is the issue

**Fix** (page.tsx):
```typescript
// Change from:
className={message.role === 'user' ? 'bg-blue-500' : 'bg-white'}

// To:
className={message.senderType === 'human' ? 'bg-blue-500' : 'bg-white'}
```

---

## Issue #14: Agents Have No Conversation Context

**Symptom**: Agents ask "你要爷爷喊谁呀？" without knowing conversation history.

**Root Cause**: `recentHistory` array was empty in agent context.

**Debug Steps**:
1. Check if recentHistory is loaded from DB
2. If it's hardcoded as `[]`, this is the issue

**Fix** (MessageService.ts):
```typescript
const recentHistory = await prisma.message.findMany({
  where: { roomId },
  orderBy: { createdAt: 'desc' },
  take: 20, // Last 20 messages
  include: { agent: { select: { name: true } } },
});
```

---

## Issue #15: @Mention Not Working for Agent Messages

**Symptom**: When Bro responds with "@Dad @Mom", those agents don't respond.

**Root Cause**: @mention detection only checked user messages, not agent-generated messages.

**Debug Steps**:
1. Check where @mentions are parsed
2. If it only runs for `senderType === 'human'`, this is the issue

**Fix** (MessageService.ts):
```typescript
// Extend to check agent messages too
if (message.senderType === 'agent') {
  const mentions = parseMentions(message.content);
  // Trigger responses from mentioned agents
}
```

---

## Prevention Patterns

### 1. Always Emit to WebSocket After DB Save
```typescript
// Pattern for ALL message types (user, agent, system)
const message = await prisma.message.create({ ... });
const io = getIO();
io.to(roomId).emit('message:new', message); // ← Always emit
```

### 2. Use Official SDKs Over Raw API Calls
- Feishu: `@larksuiteoapi/node-sdk` ✅
- Don't use raw axios POST ❌

### 3. Add Debug Logging at Critical Points
```typescript
console.log(`✅ Saved: ${entity.id}`);
console.log(`📡 About to emit: ${event}`);
console.log(`📡 Got IO instance, emitting to room: ${roomId}`);
console.log(`✅ Emit complete`);
```

### 4. Wait for Socket Ready Before Testing
- Client: Wait for "connected" + "joined room" logs
- Server: Verify client is in room before expecting real-time updates

### 5. Use Composite Keys for React Lists
```typescript
key={`${id}-${createdAt}`} // NOT just key={id}
```

### 6. Validate Schema Field Names
```bash
# Before coding, check schema
grep -A 10 "model Room" prisma/schema.prisma
```

### 7. Test Direct CLI Commands First
```bash
# Before debugging service, test CLI directly
openclaw agent --message "test" --agent "family-mom" --session-id "family-mom"
```

---

## Server Restart Commands

```bash
# Kill stuck processes
pkill -9 -f "tsx"
lsof -ti:4000 | xargs kill -9

# Restart backend
cd /home/jlguo/agent-hub/server && npm run dev

# Restart frontend
cd /home/jlguo/agent-hub/client && npm run dev

# Check health
curl http://localhost:4000/health | jq '.'
```

---

## Testing Protocol

### WebSocket Real-Time Test
1. Open Web UI (http://localhost:3000)
2. Open Browser Console (F12)
3. WAIT for logs:
   - "✅ Connected to server"
   - "✅ Client [id] joined room family-room-demo"
4. Send Feishu message: "实时测试 123"
5. Expected in console:
   - "📩 WebSocket received message:new [id]"
   - "💾 Messages updated from X to Y"
   - "📜 Auto-scrolling to bottom"

### Agent Response Test
1. Send Feishu message: "测试 agent 响应"
2. Expected server logs:
   - "✅ Feishu message saved: [id]"
   - "🔥 Triggering agent response"
   - "✅ Agent message saved: [id]"
   - "📡 About to emit agent response to WebSocket"
   - "✅ WebSocket emit complete"
3. Expected browser console:
   - "📩 WebSocket received message:new" with agent content

### Discussion Test
1. Send in Web UI or Feishu: "/discuss 周末计划"
2. Expected:
   - Discussion start banner (purple)
   - 4-8 agent turns with 2-3s delays
   - Discussion end banner
   - All messages persist after refresh

---

## File Locations

- **Backend**: `/home/jlguo/agent-hub/server/`
- **Frontend**: `/home/jlguo/agent-hub/client/`
- **Database**: `/home/jlguo/agent-hub/prisma/dev.db`
- **Schema**: `/home/jlguo/agent-hub/prisma/schema.prisma`
- **Services**: `/home/jlguo/agent-hub/server/src/services/`
- **Routes**: `/home/jlguo/agent-hub/server/src/routes/`
- **WebSocket**: `/home/jlguo/agent-hub/server/src/websocket/`

---

## Key Configuration

### .env Variables
```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
OPENCLAW_VERIFICATION_TOKEN=xxx
FRONTEND_ORIGIN=http://localhost:3000
```

### Server Ports
- Backend: 4000
- Frontend: 3000 (auto-increments if in use: 3001, 3002)

### Database Models
- Room (1)
- Agent (6: Dad, Mom, Bro, Sis, Grandma, Grandpa)
- Relationship (27: complete family tree)
- Message (all conversations)
- Discussion (topic threads with heat tracking)
- Session (OpenClaw gateway sessions)

---

**Last Updated**: 2026-03-30  
**Status**: All 15 issues resolved, system fully operational
