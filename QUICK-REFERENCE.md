# Agent Hub - Quick Reference

**Full Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 📁 Project Structure

```
~/agent-hub/
├── ARCHITECTURE.md          # 📋 Single source of truth (45KB)
├── README.md                # Project overview
├── PHASE1-TASK.md           # Current implementation tasks
├── IMPLEMENTATION-STATUS.md # Progress tracking
├── server/                  # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── routes/          # API routes
│   │   └── services/        # Business logic
│   └── tsconfig.json
├── client/                  # Frontend (Next.js)
│   └── app/
│       └── page.tsx         # Main chat UI
└── prisma/
    ├── schema.prisma        # Database schema
    └── seed.ts              # Demo data
```

---

## 🚀 Quick Start

```bash
# 1. Start OpenClaw Gateway
openclaw gateway start

# 2. Start Backend (port 4000)
cd ~/agent-hub
npm run dev:server

# 3. Start Frontend (port 3000)
cd ~/agent-hub/client
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Docs: http://localhost:4000/health

---

## 🏗️ Architecture Overview

### System Flow

```
User (Feishu) → OpenClaw Gateway → Webhook → Agent Hub Backend
                                                    ↓
                                            Select Agent (random MVP)
                                                    ↓
                                            OpenClaw Gateway (AI)
                                                    ↓
                                            Save to DB + WebSocket
                                                    ↓
                                            All users see response
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Backend | Express.js + TypeScript + Socket.io |
| Database | SQLite + Prisma ORM |
| AI | OpenClaw Gateway (webhook integration) |
| Deployment | Local (Node.js) |

### Key Components

- **Room Service** - CRUD for conversation rooms
- **Agent Service** - Agent management + relationships
- **Message Service** - Message persistence + retrieval
- **OpenClaw Service** - Webhook handler + Gateway integration
- **Session Guardian** - Auto-recovery of broken sessions (30s check)

---

## 📊 Database Schema (Core)

```prisma
Room          - Conversation spaces
Agent         - AI personas with personalities
Relationship  - Connections between agents
Message       - All messages (user + assistant)
Discussion    - Topic threads with heat scoring
Session       - OpenClaw Gateway sessions
```

---

## 🔌 API Endpoints

### Rooms
```
GET    /api/rooms              - List rooms
POST   /api/rooms              - Create room
GET    /api/rooms/:id          - Get room
GET    /api/rooms/:id/messages - Get messages
```

### Agents
```
GET    /api/agents             - List agents
POST   /api/agents             - Create agent
GET    /api/agents/:id         - Get agent details
```

### Webhooks
```
POST   /api/webhooks/openclaw  - OpenClaw inbound messages
```

### Health
```
GET    /health                 - Health check
```

---

## 🔄 WebSocket Events

### Client → Server
```typescript
socket.emit('room:join', { roomId })
socket.emit('message:send', { roomId, content, role })
```

### Server → Client
```typescript
socket.on('message:new', message)
socket.on('session:recovered', { roomId, newSessionId })
socket.on('agent:typing', { roomId, agentId })
```

---

## 🎯 Agent Selection (MVP vs v2)

### Current (MVP)
```typescript
// Random selection - equal probability
const agent = agents[Math.floor(Math.random() * agents.length)]
```

### Planned (v2) - Multi-Factor Scoring
- **Topic relevance** - Who cares about this topic?
- **Relationship** - Parent-child vs spouse vs friend
- **Personality** - Talkativeness, empathy, curiosity
- **Discussion heat** - Who's been active recently?

---

## 🔐 Environment Variables

```bash
# .env
PORT=4000
DATABASE_URL="file:./prisma/dev.db"
OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
OPENCLAW_VERIFICATION_TOKEN="your-secret-token"
SESSION_CHECK_INTERVAL=30000
SESSION_MAX_AGE=3600000
```

---

## 📋 Implementation Phases

### Phase 1: Core Infrastructure (Current)
- ✅ Backend API
- ✅ Database schema
- ✅ WebSocket messaging
- ✅ Basic frontend
- ⏳ OpenClaw webhook integration
- ⏳ Session Guardian

### Phase 2: Agent Intelligence (Week 3-4)
- Agent selection algorithm (v2)
- Discussion heat system
- Topic auto-triggering
- Agent memory windows

### Phase 3: Multi-Room & Management (Week 5-6)
- Multiple room support
- Agent management UI
- Relationship editor
- Mobile optimization

---

## 🐛 Current Issues

| Issue | Status | Priority |
|-------|--------|----------|
| WebSocket Gateway → Webhook migration | ⏳ Pending | 🔴 High |
| Prisma schema alignment | 🟡 In Progress | 🟡 Medium |
| Agent selection v2 | 📋 Planned | 🟢 Low |

---

## 📚 Key Documents

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Full architecture (read this first)
- **[PHASE1-TASK.md](./PHASE1-TASK.md)** - Current tasks
- **[IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md)** - Progress tracking

---

**Last Updated:** 2026-03-27  
**Version:** 1.0
