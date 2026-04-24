# Agent Hub

**Multi-agent collaboration platform for realistic family group conversations**

[![Status](https://img.shields.io/badge/status-production--ready-green)](.)
[![Phase](https://img.shields.io/badge/phase-2%20complete-blue)](.)
[![Tests](https://img.shields.io/badge/tests-14%2F14%20passing-brightgreen)](.)

---

## 🎯 Overview

Agent Hub brings AI family members to life in group chats. Six distinct personalities (Dad, Mom, Bro, Sis, Grandma, Grandpa) engage in natural conversations with context awareness, relationship dynamics, and heat-based engagement.

**Key Features**:

- 🔥 Heat-based response system (agents respond more to active conversations)
- 📣 @Mention targeting (100% priority, chain reactions)
- 💬 Autonomous discussions (`/discuss [topic]`)
- 👨‍👩‍👧‍👦 Family relationships (27 connections influence responses)
- 🔄 Bidirectional sync (Feishu ↔ Web UI)
- ⚡ Real-time updates (WebSocket, no refresh needed)

---

## 📚 Documentation

| Document                                                 | Description                                             |
| -------------------------------------------------------- | ------------------------------------------------------- |
| **[STATUS.md](STATUS.md)**                               | Current system status, database stats, working features |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**                   | System architecture, data flow, component design        |
| **[docs/PHASES.md](docs/PHASES.md)**                     | Development phases, timelines, completed features       |
| **[docs/FEATURES.md](docs/FEATURES.md)**                 | Comprehensive feature documentation (12 features)       |
| **[TROUBLESHOOTING-GUIDE.md](TROUBLESHOOTING-GUIDE.md)** | 15 common issues with solutions                         |
| **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)**             | Key IDs, commands, shortcuts                            |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenClaw CLI (for AI agents)
- Feishu/Lark app (optional, for Feishu integration)

### Installation

```bash
# Clone repository
cd /home/jlguo/agent-hub

# Install dependencies (backend)
npm install

# Install dependencies (frontend)
cd client && npm install && cd ..

# Setup database
npx prisma migrate dev

# Seed agents (optional)
npx tsx prisma/seed-agents.ts
```

### Development

```bash
# Start backend (port 4000)
npm run dev

# Start frontend (port 3000) in new terminal
cd client && npm run dev
```

### Testing

```bash
# Run E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/web-ui.spec.ts
```

---

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Feishu    │────────▶│  Agent Hub   │◀────────│   Web UI    │
│   (WS/SDK)  │         │   Backend    │         │  (Next.js)  │
└─────────────┘         └──────────────┘         └─────────────┘
                              │    │
                              │    │
                              ▼    ▼
                        ┌──────────┐  ┌────────────┐
                        │ OpenClaw │  │  SQLite    │
                        │   CLI    │  │  Database  │
                        └──────────┘  └────────────┘
```

### Components

| Component      | Port | Technology              | Purpose                             |
| -------------- | ---- | ----------------------- | ----------------------------------- |
| Backend API    | 4000 | Express.js + TypeScript | REST API, WebSocket, business logic |
| Frontend       | 3000 | Next.js 14 + React      | Web UI, real-time chat              |
| Database       | -    | SQLite + Prisma ORM     | Data persistence                    |
| Feishu Gateway | -    | @larksuiteoapi/node-sdk | Feishu integration                  |
| OpenClaw       | -    | CLI                     | AI agent generation                 |

### Data Models

- **Room**: Feishu chat container (externalChatId for Feishu mapping)
- **Agent**: AI family members (personality traits 0-100)
- **Relationship**: Family connections (strength 0-100%)
- **Message**: All conversations (senderType: human/agent/system)
- **Discussion**: Topic threads (heat tracking 0-100)
- **Session**: OpenClaw gateway sessions (lifecycle tracking)

---

## 👥 Agent Family

| Agent   | Name   | Role        | Talk | Emp | Cur | Avatar |
| ------- | ------ | ----------- | ---- | --- | --- | ------ |
| Dad     | 张建国 | Father      | 70   | 60  | 50  | 👨     |
| Mom     | 李秀英 | Mother      | 60   | 80  | 60  | 👩     |
| Bro     | 张小明 | Brother     | 60   | 50  | 70  | 👦     |
| Sis     | 张小雨 | Sister      | 70   | 60  | 80  | 👧     |
| Grandma | 王桂英 | Grandmother | 70   | 90  | 60  | 👵     |
| Grandpa | 张德明 | Grandfather | 60   | 80  | 50  | 👴     |

**Relationships**: 27 total connections (spouse, parent-child, siblings, grandparents, in-laws)

---

## 🎮 Features

### 1. Heat-Based Responses 🔥

- **0-100 scale** with 15% decay per 30s
- **Thresholds**: HOT (70+ = 80%), WARM (40-70 = 50%), COLD (20-40 = 30%), INACTIVE (<20 = 10%)
- Agents respond more to active conversations

### 2. @Mention Targeting 📣

- **100% priority** for mentioned agents (bypasses heat probability)
- **Agent-to-agent** chain reactions (Bro → @Dad @Mom → both respond)
- **60s cooldown** per agent to prevent spam
- **Smart fallback** for unknown @mentions

### 3. Autonomous Discussions 💬

- **Commands**: `/discuss [topic]`, "Let's discuss [topic]"
- **2-4 agents** participate with 4-8 turns
- **2-3s delays** between responses for natural flow
- **System banners** for start/end (purple styling)

### 4. Conversation Context 🧠

- **Last 20 messages** loaded from database
- **Multi-turn awareness** (reference previous messages)
- **Relationship context** included in prompts

### 5. Bidirectional Sync 🔄

- **Feishu → Web UI**: Real-time via WebSocket
- **Web UI → Feishu**: HTTP API with SDK
- **Discussions sync**: Both directions with system banners

### 6. Real-Time Updates ⚡

- **Socket.io** for WebSocket communication
- **~50-100ms latency** for message delivery
- **Auto-reconnect** with exponential backoff
- **No page refresh** needed

**See [docs/FEATURES.md](docs/FEATURES.md) for complete feature documentation (12 features)**

---

## 📊 Current Status

### System Health

| Component        | Status       | Notes           |
| ---------------- | ------------ | --------------- |
| Backend (4000)   | ✅ Running   | tsx watch mode  |
| Frontend (3000)  | ✅ Running   | Next.js dev     |
| Database         | ✅ Connected | SQLite          |
| Feishu WebSocket | ✅ Connected | Official SDK    |
| OpenClaw CLI     | ✅ Working   | 120s timeout    |
| Heat Tracker     | ✅ Active    | 30s decay cycle |
| WebSocket        | ✅ Connected | Socket.io       |

### Database Stats

- **Rooms**: 1 (family-room-demo)
- **Agents**: 6 (all configured)
- **Relationships**: 27 (complete family tree)
- **Messages**: ~300 (varies with testing)
- **Discussions**: Active threads with heat tracking

### Test Coverage

- **E2E Tests**: 14/14 passing (100%)
- **Coverage**: Application Load, Room Management, Messaging, API Integration, Error Handling, UI Elements, Performance

**See [STATUS.md](STATUS.md) for detailed status**

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Feishu Integration
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
FEISHU_VERIFY_TOKEN=xxx

# OpenClaw
OPENCLAW_VERIFICATION_TOKEN=xxx

# Frontend
FRONTEND_ORIGIN=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

### OpenClaw Agent Configuration

```bash
# List configured agents
openclaw agents list

# Expected agents
family-mom, family-dad, family-bro, family-sis, family-grandma, family-grandpa
```

---

## 🧪 Testing

### E2E Tests

```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific file
npx playwright test tests/e2e/web-ui.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed
```

### Manual Testing

1. **Heat System**: Send 3-5 rapid messages, verify agent responses increase
2. **@Mentions**: "@Mom @Dad" → both respond with 2-3s delays
3. **Discussions**: "/discuss 周末计划" → 4-8 agent turns
4. **Chain Reactions**: "@Bro" → Bro responds with "@Dad @Mom" → both respond
5. **Bidirectional Sync**: Send in Feishu → appears in Web UI (and vice versa)

---

## 🐛 Troubleshooting

**Common Issues** (see [TROUBLESHOOTING-GUIDE.md](TROUBLESHOOTING-GUIDE.md)):

1. **Agent responses show in Feishu but not Web UI** → Missing WebSocket emit
2. **Messages disappear after refresh** → API orderBy wrong
3. **OpenClaw CLI timeout** → Increase to 120s
4. **Agent name mismatch** → Add name mapping
5. **Feishu WebSocket 404** → Use official SDK
6. **Room lookup fails** → Use externalChatId not settings
7. **WebSocket timing issue** → Wait for room join before sending
8. **Duplicate messages** → Use WebSocket as single source
9. **Auto-scroll broken** → Re-enable with useEffect
10. **React key warnings** → Use composite keys

**Full troubleshooting guide**: 15 issues with step-by-step solutions

---

## 📁 Project Structure

```
/home/jlguo/agent-hub/
├── README.md                    # This file
├── STATUS.md                    # Current system status
├── ARCHITECTURE.md              # System architecture
├── QUICK-REFERENCE.md           # Key IDs, commands
├── TROUBLESHOOTING-GUIDE.md     # 15 common issues
├── docs/
│   ├── PHASES.md               # Development phases
│   ├── FEATURES.md             # Feature documentation
│   └── ARCHIVE/                # Historical files (empty)
├── memory/
│   └── 2026-03-30.md           # Session memories
├── server/
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── services/           # Business logic
│   │   ├── routes/             # API routes
│   │   └── websocket/          # Socket.io handlers
│   └── package.json
├── client/
│   ├── app/
│   │   ├── page.tsx            # Main chat UI
│   │   └── layout.tsx          # Root layout
│   └── package.json
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── dev.db                  # SQLite database
│   └── seed-agents.ts          # Agent seeding script
├── tests/
│   └── e2e/
│       ├── web-ui.spec.ts      # Web UI E2E tests
│       └── discussion.spec.ts  # Discussion feature tests
└── playwright.config.ts        # Playwright configuration
```

---

## 🚀 Roadmap

### Phase 1: Core Infrastructure ✅ COMPLETE

- Database schema + migrations
- OpenClaw integration
- Feishu WebSocket integration
- Web UI with real-time updates
- Bidirectional sync

### Phase 2: Agent Intelligence ✅ COMPLETE

- Heat-based response system
- Agent selection algorithm
- @Mention targeting
- Autonomous discussions
- Conversation context
- Family relationships

### Phase 3: Polish & Production 🚧 IN PROGRESS

- ✅ Documentation cleanup
- ✅ Codebase consolidation
- 🔄 Performance optimization
- 🔄 Error handling improvements
- ⏳ Monitoring/alerting
- ⏳ Message encryption
- ⏳ Rate limiting
- ⏳ Admin dashboard
- ⏳ CI/CD pipeline

**See [docs/PHASES.md](docs/PHASES.md) for detailed phase documentation**

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- **OpenClaw**: AI agent framework
- **Feishu/Lark**: Collaboration platform
- **Next.js**: React framework
- **Prisma**: Database ORM
- **Socket.io**: Real-time communication

---

**Last Updated**: 2026-03-30  
**Version**: 2.0 (Phase 2 Complete)

---

## 📊 Code Coverage

Coverage reports are generated locally using Istanbul/NYC:

```bash
# Run tests with coverage
npm run test:coverage

# Check coverage against thresholds
npm run test:coverage:check

# View HTML report
open coverage/unit/index.html
```

**Current Coverage**: 7.5% lines, 16.4% functions (baseline)
**Target**: 80%+ across all metrics

**Why no Codecov?**: We keep coverage reports local for simplicity and privacy. HTML reports provide all needed insights without external service dependencies.
