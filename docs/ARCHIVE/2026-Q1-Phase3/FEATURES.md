# Agent Hub - Features Documentation

**Last Updated**: 2026-03-30

---

## 1. Heat-Based Response System 🔥

### Overview

Agents respond based on conversation "heat" - more active discussions get more agent engagement.

### Configuration

- **Scale**: 0-100 heat
- **Thresholds**:
  - HOT: 70+ heat (80% response probability)
  - WARM: 40-70 heat (50% response probability)
  - COLD: 20-40 heat (30% response probability)
  - INACTIVE: <20 heat (10% response probability)
- **Decay**: 15% per 30-second cycle
- **Archive**: Discussions auto-archive when heat < 5

### Heat Increments

- User message: +23 heat (base)
- Agent response: +15 heat
- @Mention: +30 heat

### Implementation

- Service: `server/src/services/heat-tracker.service.ts`
- In-memory cache for performance
- WebSocket events for real-time heat updates
- Database persistence for discussions

---

## 2. Agent Selection Algorithm 🎯

### 6-Factor Weighted Scoring

| Factor           | Weight | Description                          |
| ---------------- | ------ | ------------------------------------ |
| Topic Relevance  | 30%    | How well agent's role matches topic  |
| Relationship     | 25%    | Strength of relationship with sender |
| Personality      | 25%    | Talkativeness, empathy, curiosity    |
| Heat Bonus       | 10%    | Higher heat = higher bonus           |
| Cooldown Penalty | 10%    | Recent responses reduce score        |
| Random Variance  | 5%     | Tiebreaker, adds unpredictability    |

### Selection Process

1. Parse @mentions (if any)
2. Check cooldown status
3. Calculate weighted scores for eligible agents
4. Apply minimum threshold (0.25)
5. Select top-scoring agent(s)

### Cooldown System

- **Duration**: 60 seconds per agent
- **Purpose**: Prevent spam, ensure variety
- **Tracking**: In-memory map (agentId → expiryTimestamp)

---

## 3. @Mention Feature 📣

### 100% Priority Selection

When an agent is @mentioned, they respond 100% of the time (bypasses heat probability).

### Matching Rules

- **By Name**: "@Mom", "@Dad", "@Grandma"
- **By ID**: "@family-mom", "@family-dad"
- **By Role**: "@mother", "@father", "@grandmother"
- **Case Insensitive**: "@mom" = "@Mom"

### Agent-to-Agent @Mentions

- Agents can @mention other agents in their responses
- Triggers chain reactions (Bro → @Dad @Mom → both respond)
- Same 100% priority + 60s cooldown applies
- 2-3 second delays between responses

### Smart Fallback

Unknown @mentions get helpful clarification:

> "We don't have Uncle here! But Dad can help~"

### Multiple @Mentions

"@Mom @Dad @Bro 晚上想吃什么？" → All three respond sequentially with 2-3s delays.

### Implementation

- Parser: `parseMentions(content)` function
- Regex: `/@(\w+)/g`
- Service: `server/src/services/MessageService.ts`

---

## 4. Autonomous Discussions 💬

### Trigger Commands

- `/discuss [topic]`
- "Let's discuss [topic]"
- "咱们讨论一下 [topic]"

### Discussion Flow

1. **Start Banner**: System message with purple background

   > "🎙️ Discussion Started: [topic]"

2. **Agent Turns**: 4-8 messages from 2-4 agents
   - 2-3 second delays between responses
   - Context-aware (reference previous turns)
   - Personality-driven responses

3. **End Banner**: System message
   > "✅ Discussion Ended"

### Features

- Real-time WebSocket updates (no refresh needed)
- System messages persist to database
- Bidirectional sync (Feishu ↔ Web UI)
- Heat tracking during discussions

### Implementation

- Service: `server/src/services/DiscussionService.ts`
- Route: `server/src/routes/messages.ts`
- Frontend: System message rendering with purple background

---

## 5. Conversation Context 🧠

### Recent History Loading

- **Last 20 messages** loaded from database
- Includes sender names and agent information
- Formatted as conversation transcript in prompts

### Prompt Structure

```
You are [Agent Name], [role].

Personality:
- Talkativeness: X/10
- Empathy: Y/10
- Curiosity: Z/10

Relationships:
- [Person A]: [relationship] (strength: N%)
- [Person B]: [relationship] (strength: N%)

Recent Conversation:
[Sender 1]: [message 1]
[Sender 2]: [message 2]
...

Current Message: [user message]

Respond naturally as [Agent Name].
```

### Benefits

- Multi-turn conversations
- Context-aware responses
- Reference previous messages
- Natural conversation flow

---

## 6. Family Relationships 👨‍👩‍👧‍👦

### Family Tree (27 Relationships)

**Dad (张建国)**:

- Spouse: Mom (strength: 90%)
- Children: Bro, Sis (strength: 95% each)
- Parents: Grandma, Grandpa
- Relationships: 9 total

**Mom (李秀英)**:

- Spouse: Dad
- Children: Bro, Sis
- In-laws: Grandma, Grandpa
- Relationships: 8 total

**Bro (张小明)**:

- Parents: Dad, Mom
- Sister: Sis
- Grandparents: Grandma, Grandpa
- Relationships: 10 total

**Sis (张小雨)**:

- Parents: Dad, Mom
- Brother: Bro
- Grandparents: Grandma, Grandpa
- Relationships: 9 total

**Grandma (王桂英)**:

- Spouse: Grandpa
- Son: Dad
- Daughter-in-law: Mom
- Grandchildren: Bro, Sis
- Relationships: 9 total

**Grandpa (张德明)**:

- Spouse: Grandma
- Son: Dad
- Daughter-in-law: Mom
- Grandchildren: Bro, Sis
- Relationships: 9 total

### Relationship Types

- `spouse` - Married couples
- `parent-of` - Parent to child
- `child-of` - Child to parent
- `sibling-of` - Brothers/sisters
- `grandparent-of` - Grandparent to grandchild
- `grandchild-of` - Grandchild to grandparent
- `parent-in-law-of` - In-law relationships

### Impact on Agent Selection

- Relationship strength adds 0-25% to selection score
- Agents more likely to respond to family members they're close to
- Relationship context included in prompts

---

## 7. Agent Personas 🎭

### SOUL.md Files

Each agent has a SOUL.md file defining their personality:

**Location**: `~/.openclaw/agents/family-[name]/agent/SOUL.md`

### Personality Traits (0-100 Scale)

- **Talkativeness**: How much they speak
- **Empathy**: Emotional understanding
- **Curiosity**: Interest in learning/asking

### Agent Profiles

| Agent   | Talk | Emp | Cur | Role        | Characteristics            |
| ------- | ---- | --- | --- | ----------- | -------------------------- |
| Dad     | 70   | 60  | 50  | Father      | Supportive, problem-solver |
| Mom     | 60   | 80  | 60  | Mother      | Caring, offers food        |
| Bro     | 60   | 50  | 70  | Brother     | Enthusiastic, curious      |
| Sis     | 70   | 60  | 80  | Sister      | Playful, asks questions    |
| Grandma | 70   | 90  | 60  | Grandmother | Wise, caring, storytelling |
| Grandpa | 60   | 80  | 50  | Grandfather | Storytelling, historical   |

### Chinese Grandparent Personas

**Grandma (王桂英)**:

- ~70 years old
- 慈祥、温和、有智慧、疼爱孙辈
- Uses: "宝贝", "乖孙", "奶奶跟你说"

**Grandpa (张德明)**:

- ~75 years old
- 稳重、睿智、幽默、有威严但慈祥
- Uses: "乖孙", "古人云", historical stories

---

## 8. Real-Time Updates ⚡

### WebSocket Architecture

- **Protocol**: Socket.io
- **Events**:
  - `message:new` - New message (user or agent)
  - `room:join` - Client joins room
  - `session:recovered` - Session restored

### Flow

1. User sends message (Feishu or Web UI)
2. Backend saves to database
3. Backend emits `message:new` via WebSocket
4. All connected clients in room receive update
5. Frontend updates UI without refresh

### Timing

- **Latency**: ~50-100ms
- **Auto-reconnect**: Exponential backoff
- **Heartbeat**: Every 30 seconds

---

## 9. Bidirectional Sync 🔄

### Feishu ↔ Web UI

**Feishu → Web UI**:

1. Feishu message received via WebSocket SDK
2. Saved to database
3. Emitted to WebSocket room
4. Web UI updates in real-time

**Web UI → Feishu**:

1. User sends message in Web UI
2. Saved to database
3. Check if room has `externalChatId`
4. If yes, send to Feishu via SDK
5. Feishu group receives message

### Discussion Sync

- `/discuss` from Feishu → appears in Web UI
- `/discuss` from Web UI → appears in Feishu
- All discussion turns sync bidirectionally
- System banners (start/end) sync as well

---

## 10. Agent Avatars 👤

### Avatar Emojis

- Dad: 👨
- Mom: 👩
- Bro: 👦
- Sis: 👧
- Grandma: 👵
- Grandpa: 👴

### Display Locations

- **Message List**: Small avatar next to agent name
- **Agent Messages**: Large avatar on left side of message bubble
- **Agent Info**: Avatar in agent profile/cards

### Implementation

- Database: `Agent.avatar` field
- API: Returns `agentAvatar` with all messages
- WebSocket: Includes `agentAvatar` in emits
- Frontend: Renders avatar based on `senderType`

---

## 11. System Messages 🎙️

### Types

1. **Discussion Start**: Purple banner

   > "🎙️ Discussion Started: [topic]"

2. **Discussion End**: Purple banner

   > "✅ Discussion Ended"

3. **Smart Fallback**: For unknown @mentions
   > "We don't have Uncle here! But Dad can help~"

### Characteristics

- `senderType: 'system'`
- Purple background styling
- Persist to database
- Real-time WebSocket updates
- Not counted in message history for agents

---

## 12. Session Management 🛡️

### Session Guardian Service

- **Check Interval**: 30 seconds
- **Max Session Age**: 1 hour
- **Auto-Recovery**: Expired sessions auto-renewed
- **Rotation**: Stale sessions cleaned up

### Session Tracking

- **Model**: `Session` in database
- **States**: active, expired, terminated
- **Gateway ID**: OpenClaw session identifier
- **Room Binding**: Links session to Feishu chat

---

## Implementation Files

| Feature            | Service File                         | Route File           |
| ------------------ | ------------------------------------ | -------------------- |
| Heat Tracking      | `services/heat-tracker.service.ts`   | -                    |
| Agent Selection    | `services/agent-selector.service.ts` | -                    |
| @Mentions          | `services/MessageService.ts`         | -                    |
| Discussions        | `services/DiscussionService.ts`      | `routes/messages.ts` |
| Feishu Integration | `services/FeishuOfficialService.ts`  | -                    |
| OpenClaw           | `services/OpenClawService.ts`        | -                    |
| WebSocket          | `websocket/index.ts`                 | -                    |

---

## Testing

### Manual Tests

1. **Heat System**: Send 3-5 rapid messages, verify agent responses increase
2. **@Mentions**: "@Mom @Dad" → both respond with 2-3s delays
3. **Discussions**: "/discuss 周末计划" → 4-8 agent turns
4. **Chain Reactions**: "@Bro" → Bro responds with "@Dad @Mom" → both respond
5. **Cooldown**: "@Bro" twice in 60s → second skipped

### E2E Tests

- Location: `tests/e2e/web-ui.spec.ts`
- Coverage: 14 tests (Application Load, Room Management, Messaging, API Integration, Error Handling, UI Elements, Performance)
- Status: ✅ All passing

---

**For Troubleshooting**: See `TROUBLESHOOTING-GUIDE.md`  
**For Quick Reference**: See `QUICK-REFERENCE.md`  
**For Architecture**: See `ARCHITECTURE.md`
