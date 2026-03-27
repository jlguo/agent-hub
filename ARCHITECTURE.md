# Agent Hub - Comprehensive Architecture Design

**Version:** 2.0  
**Date:** 2026-03-26  
**Status:** Authoritative Source of Truth  
**Author:** Architect (Senior System Architect & Technical Lead)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Principles](#3-architecture-principles)
4. [System Context](#4-system-context)
   - [4.1 High-Level Context Diagram](#41-high-level-context-diagram)
   - [4.2 Detailed Context Diagram](#42-detailed-context-diagram-web-ui-flow)
   - [4.3 Complete Request Flow](#43-complete-request-flow-web-ui)
   - [4.4 Key Design Decisions](#44-key-design-decisions)
   - [4.5 External Dependencies](#45-external-dependencies)
   - [4.6 Integration Points](#46-integration-points)
5. [Component Architecture](#5-component-architecture)
6. [Data Architecture](#6-data-architecture)
7. [API Architecture](#7-api-architecture)
8. [Integration Architecture](#8-integration-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Scalability & Performance](#11-scalability-and-performance)
12. [Evolution Roadmap](#12-evolution-roadmap)
13. [Appendices](#13-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

Agent Hub is a **multi-agent collaboration platform** that enables realistic group conversations with AI-powered agents. Each agent has distinct personality, memory, and relationships, creating natural conversation dynamics.

### 1.2 Core Value Proposition

- **Relationship-aware AI**: Agents understand their relationships with each other and users
- **Natural conversation flow**: Discussion heat system prevents chaotic multi-agent responses
- **Mobile-first design**: Optimized for on-the-go family/personal communication
- **OpenClaw integration**: Leverages OpenClaw Gateway for AI responses while maintaining control

### 1.3 Key Decisions (MVP)

| Decision | Rationale |
|----------|-----------|
| Single admin user | Avoid auth complexity for MVP |
| Agent memory + room context | Per-agent context windows for coherent conversations |
| Admin-triggered topics | No complex auto-trigger for MVP |
| Family case as MVP | Parent, child, spouse, grandparent relationships |
| One OpenClaw session per room | Persisted sessions with max age setting |
| Local deployment | SQLite, no cloud infrastructure |
| **Webhook (inbound)** | Official OpenClaw API, stable and documented |
| **CLI (outbound)** | Simple, works immediately, no API compatibility concerns |

---

## 2. System Overview

### 2.1 System Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT HUB ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │  Family  │     │ Friends  │     │ Work     │                │
│  │  Room    │     │  Room    │     │  Room    │                │
│  │          │     │          │     │          │                │
│  │ 👨 👩 👧  │     │ 🧑 🧑 🧑 │     │ 👔 👔 👔 │                │
│  └──────────┘     └──────────┘     └──────────┘                │
│                                                                 │
│  Each room:                                                     │
│  - Multiple AI agents with personalities                        │
│  - Relationship graph (family, friends, colleagues)             │
│  - Shared conversation history                                  │
│  - Discussion heat tracking                                     │
│  - Smart agent response selection                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 User Stories (MVP)

**Primary User: Family Parent (Admin)**

1. **Create Family Room**: Admin creates a room and adds family member agents
2. **Start Conversation**: Admin sends a message to the family room
3. **Receive Responses**: One or more agents respond naturally based on context
4. **View History**: Admin can scroll through conversation history
5. **Manage Agents**: Admin can add/remove agents, adjust personalities

**Secondary Users: Family Members (View Only for MVP)**

1. **View Conversations**: See all messages in family room
2. **Receive Notifications**: Get notified when new messages arrive

### 2.3 Key Metrics (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Message latency | < 3s (P95) | Gateway response time |
| Agent response rate | 80%+ | Messages that get agent response |
| System uptime | 99%+ | Local server availability |
| Conversation coherence | Subjective | User satisfaction |

---

## 3. Architecture Principles

### 3.1 Design Principles

1. **Simplicity First**: MVP focuses on family use case, avoid over-engineering
2. **Local-First**: Run on user's machine, no cloud dependency
3. **Official APIs**: Use OpenClaw webhooks (not internal protocols)
4. **Mobile-First**: Responsive design, touch-optimized UI
5. **Extensible Core**: Design for future multi-user, multi-room expansion

### 3.2 Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 + TypeScript | SSR, mobile optimization, shadcn/ui |
| Backend | Express.js + TypeScript | Lightweight, flexible, WebSocket support |
| Database | SQLite + Prisma | Local-first, type-safe, easy migrations |
| Real-time | Socket.io | Room-based messaging, auto-reconnect |
| AI Integration | OpenClaw Gateway (webhook) | Official API, stable, documented |
| Deployment | Local (Node.js) | No infrastructure, user controls data |

### 3.3 Non-Goals (for MVP)

- ❌ Multi-user authentication
- ❌ Cloud deployment
- ❌ Complex topic auto-triggering
- ❌ Advanced discussion heat algorithm
- ❌ Agent learning/adaptation
- ❌ Voice/video integration

---

## 4. System Context

### 4.1 High-Level Context Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         AGENT HUB SYSTEM                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Agent Hub Backend                           │  │
│  │  - Express.js API Server                                       │  │
│  │  - WebSocket Server (Socket.io)                                │  │
│  │  - SQLite Database                                             │  │
│  │  - Session Guardian Service                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
       ▲                    │                    ▲
       │                    │                    │
       │ 1. User messages   │ 2. Webhook         │ 3. AI responses
       │    (Feishu UI)     │    callbacks       │    (OpenClaw API)
       │                    │                    │
       │                    ▼                    │
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│   Feishu     │   │  OpenClaw        │   │  OpenClaw    │
│   Client     │   │  Gateway         │   │  CLI/API     │
│  (Mobile)    │   │  (port 18789)    │   │              │
└──────────────┘   └──────────────────┘   └──────────────┘
       │                    ▲                    │
       │                    │                    │
       └────────────────────┴────────────────────┘
                    4. Admin management
                       (Web UI)
```

### 4.2 Detailed Context Diagram (Web UI Flow)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT HUB SYSTEM CONTEXT                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   Web Browser    │
│  (Next.js UI)    │
│  localhost:3000  │
└────────┬─────────┘
         │
         │ 1. User types message
         │ 2. HTTP POST /api/messages
         │ 3. WebSocket connection (real-time)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AGENT HUB BACKEND                                       │
│                         (Express.js)                                            │
│                         localhost:4000                                          │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │  REST API Routes                                                          │ │
│  │  - POST /api/messages          ← User messages                            │ │
│  │  - GET  /api/rooms/:id/messages ← Load history                            │ │
│  │  - POST /api/webhooks/openclaw ← OpenClaw webhooks (future)               │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                            │
│                                    ▼                                            │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │  Service Layer                                                            │ │
│  │  - Message Service (save to DB)                                           │ │
│  │  - OpenClaw Service (trigger AI)                                          │ │
│  │  - Session Guardian (health check)                                        │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                            │
│                                    ▼                                            │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │  WebSocket Server (Socket.io)                                             │ │
│  │  - Emits: message:new, message:updated, session:recovered                 │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                            │
└────────────────────────────────────┼────────────────────────────────────────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │               │               │
                     │               │               │
                     ▼               ▼               ▼
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │  SQLite    │  │ OpenClaw   │  │  Feishu    │
            │  Database  │  │ CLI/API    │  │  Webhook   │
            │  (local)   │  │ (optional) │  │  (future)  │
            └────────────┘  └─────┬──────┘  └────────────┘
                                  │
                                  │ 4. openclaw agent --message
                                  │ 5. AI response (stdout)
                                  │
                                  ▼
                        ┌─────────────────┐
                        │ OpenClaw        │
                        │ Gateway         │
                        │ localhost:18789 │
                        └─────────────────┘
```

### 4.3 Complete Request Flow (Web UI)

**Flow 1: User Sends Message → AI Responds → Web UI Updates**

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │  Web    │     │ Backend │     │Database │     │OpenClaw │
│ (Human) │     │   UI    │     │Express  │     │ SQLite  │     │Gateway  │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ 1. Type msg   │               │               │               │
     │ "Dinner?"     │               │               │               │
     │──────────────>│               │               │               │
     │               │               │               │               │
     │               │ 2. POST       │               │               │
     │               │ /api/messages │               │               │
     │               │ {roomId,      │               │               │
     │               │  content}     │               │               │
     │               │──────────────>│               │               │
     │               │               │               │               │
     │               │               │ 3. Save msg   │               │
     │               │               │ to DB         │               │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │ 4. DB confirm │               │
     │               │               │<──────────────│               │
     │               │               │               │               │
     │               │ 5. HTTP 201   │               │               │
     │               │ (message saved)               │               │
     │               │<──────────────│               │               │
     │               │               │               │               │
     │               │               │ 6. Trigger AI │               │
     │               │               │ (background)  │               │
     │               │               │──────────────────────────────>│
     │               │               │               │               │
     │               │               │               │ 7. Generate   │
     │               │               │               │ AI response   │
     │               │               │               │ "Sure! Pizza?"│
     │               │               │<──────────────────────────────│
     │               │               │               │               │
     │               │               │ 8. Save AI    │               │
     │               │               │ response to DB│               │
     │               │               │──────────────>│               │
     │               │               │               │               │
     │               │               │ 9. Emit WS    │               │
     │               │<──────────────│ event         │               │
     │               │ message:new   │               │               │
     │               │ (AI response) │               │               │
     │ 10. See AI    │               │               │               │
     │ response      │◄──────────────┴───────────────┴───────────────┘
     │ "Sure! Pizza?"│               (Real-time via WebSocket)
     │               │
     ▼               ▼
```

**Step-by-Step Breakdown:**

| Step | From | To | Method | Data |
|------|------|-----|--------|------|
| 1 | User | Web UI | Type | "Dinner tonight?" |
| 2 | Web UI | Backend | HTTP POST | `{roomId, content}` |
| 3 | Backend | Database | Prisma | Save user message |
| 4 | Database | Backend | Return | Message ID |
| 5 | Backend | Web UI | HTTP 201 | Message saved |
| 6 | Backend | OpenClaw | CLI/API | Trigger AI |
| 7 | OpenClaw | Backend | Return | "Sure! Want pizza?" |
| 8 | Backend | Database | Prisma | Save AI response |
| 9 | Backend | Web UI | WebSocket | `message:new` event |
| 10 | Web UI | User | Render | Show AI response |

### 4.4 Protocol Decisions

**OpenClaw ↔ Agent Hub Integration Protocols**

| Direction | Protocol | Status | Rationale |
|-----------|----------|--------|-----------|
| **OpenClaw → Agent Hub** | **Webhook (HTTP POST)** | ✅ Primary | Official API, stable, documented |
| **Agent Hub → OpenClaw** | **CLI (process spawn)** | ✅ Primary | Simple, works immediately |
| Agent Hub → OpenClaw | HTTP API | ❌ Not used | API not confirmed, CLI sufficient |
| Agent Hub → OpenClaw | WebSocket | ❌ Not used | Undocumented, unstable protocol |

**Why Webhook for Inbound (OpenClaw → Agent Hub):**
- ✅ Official OpenClaw API
- ✅ Push-based (no polling)
- ✅ Simple HTTP/JSON
- ✅ Token-based authentication
- ✅ Stateless, scalable

**Why CLI for Outbound (Agent Hub → OpenClaw):**
- ✅ Works immediately (no API discovery needed)
- ✅ Simple to implement and debug
- ✅ No API compatibility concerns
- ✅ Less likely to break on OpenClaw updates
- ❌ Slower than HTTP (process spawn overhead)
- ❌ Not ideal for high-volume (acceptable for MVP)

**Why NOT WebSocket for Outbound:**
- ❌ Undocumented internal protocol
- ❌ We encountered "invalid request frame" errors
- ❌ Complex connection management
- ❌ May break on OpenClaw updates

**Why Not Direct Web UI → OpenClaw?**

```
❌ Wrong: Web UI → OpenClaw → AI Response
   - CORS issues
   - Authentication complexity
   - No message persistence
   - No agent selection logic

✅ Correct: Web UI → Backend → OpenClaw → Backend → WebSocket → Web UI
   - Full control over agent selection
   - Message persistence
   - WebSocket real-time updates
   - Single source of truth
```

### 4.5 External Dependencies

| Dependency | Purpose | Criticality | Fallback |
|------------|---------|-------------|----------|
| OpenClaw Gateway | AI responses | High | Mock responses |
| Feishu | User interface | High | Web UI only |
| Node.js 22+ | Runtime | High | N/A |
| SQLite | Data persistence | High | N/A |

### 4.6 Integration Points

**4.6.1 OpenClaw Integration (Inbound - Webhook)**

```
Feishu User → OpenClaw Gateway → Webhook → Agent Hub
                                    POST /api/webhooks/openclaw
```

**4.6.2 OpenClaw Integration (Outbound - CLI/API)**

```
Agent Hub → OpenClaw CLI/API → OpenClaw Gateway → Feishu User
```

**4.6.3 Session Management**

```
Agent Hub → OpenClaw sessions_list tool → Session health check
Agent Hub → OpenClaw process tool → Session recovery
```

---

## 5. Component Architecture

### 5.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT HUB SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        FRONTEND (Next.js)                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │ │
│  │  │ Room List   │  │ Chat View   │  │ Agent Mgmt  │               │ │
│  │  │ Component   │  │ Component   │  │ Component   │               │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │              WebSocket Client (Socket.io)                   │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │ HTTP/WS                                  │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                        BACKEND (Express)                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │ │
│  │  │ REST API    │  │ WebSocket   │  │ Webhook     │               │ │
│  │  │ Routes      │  │ Handler     │  │ Endpoint    │               │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │                    Service Layer                            │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │ │
│  │  │  │ Room Service │  │ Agent Service│  │ Message      │      │ │ │
│  │  │  │              │  │              │  │ Service      │      │ │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘      │ │ │
│  │  │  ┌──────────────┐  ┌──────────────┐                        │ │ │
│  │  │  │ OpenClaw     │  │ Session      │                        │ │ │
│  │  │  │ Service      │  │ Guardian     │                        │ │ │
│  │  │  └──────────────┘  └──────────────┘                        │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │ Prisma                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                      DATABASE (SQLite)                            │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │ │
│  │  │  Room    │  │  Agent   │  │ Message  │  │Relation- │         │ │
│  │  │  Table   │  │  Table   │  │  Table   │  │  ship    │         │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │ │
│  │  ┌──────────┐  ┌──────────┐                                      │ │
│  │  │Discussion│  │  Session │                                      │ │
│  │  │  Table   │  │  Table   │                                      │ │
│  │  └──────────┘  └──────────┘                                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Backend Services

#### 5.2.1 Room Service

**Responsibilities:**
- CRUD operations for rooms
- Room membership management
- Room metadata (description, settings)

**API:**
```typescript
interface RoomService {
  createRoom(data: CreateRoomDTO): Promise<Room>;
  getRoom(id: string): Promise<Room | null>;
  listRooms(): Promise<Room[]>;
  updateRoom(id: string, data: UpdateRoomDTO): Promise<Room>;
  deleteRoom(id: string): Promise<void>;
  addAgentToRoom(roomId: string, agentId: string): Promise<void>;
  removeAgentFromRoom(roomId: string, agentId: string): Promise<void>;
}
```

#### 5.2.2 Agent Service

**Responsibilities:**
- CRUD operations for agents
- Agent personality management
- Relationship graph management

**API:**
```typescript
interface AgentService {
  createAgent(data: CreateAgentDTO): Promise<Agent>;
  getAgent(id: string): Promise<Agent | null>;
  listAgents(): Promise<Agent[]>;
  updateAgent(id: string, data: UpdateAgentDTO): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;
  createRelationship(data: CreateRelationshipDTO): Promise<Relationship>;
  getRelationships(agentId: string): Promise<Relationship[]>;
}
```

#### 5.2.3 Message Service

**Responsibilities:**
- Message persistence
- Message retrieval (pagination, filtering)
- Message metadata (reactions, edits)

**API:**
```typescript
interface MessageService {
  createMessage(data: CreateMessageDTO): Promise<Message>;
  getMessages(roomId: string, options: MessageOptions): Promise<Message[]>;
  updateMessage(id: string, content: string): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}
```

#### 5.2.4 OpenClaw Service

**Responsibilities:**
- Webhook endpoint for inbound messages
- Outbound message sending to OpenClaw
- Session management with OpenClaw Gateway

**API:**
```typescript
interface OpenClawService {
  // Inbound webhook handler
  handleWebhook(payload: WebhookPayload): Promise<void>;
  
  // Outbound message sending
  sendMessage(sessionId: string, message: string, agentContext: AgentContext): Promise<string>;
  
  // Session management
  createSession(roomId: string): Promise<string>;
  getSession(roomId: string): string | null;
  closeSession(sessionId: string): Promise<void>;
}
```

#### 5.2.5 Session Guardian Service

**Responsibilities:**
- Periodic health checks on OpenClaw sessions
- Auto-recovery of broken/expired sessions
- Session cleanup and rotation

**Implementation:**
```typescript
class SessionGuardian {
  private checkInterval: number = 30000; // 30 seconds
  private sessionMaxAge: number = 3600000; // 1 hour
  
  async start(): Promise<void> {
    setInterval(() => this.checkAllSessions(), this.checkInterval);
  }
  
  private async checkAllSessions(): Promise<void> {
    const sessions = await this.getAllActiveSessions();
    for (const session of sessions) {
      const health = await this.checkSessionHealth(session.id);
      if (!health.healthy) {
        await this.recoverSession(session.id);
      }
      if (health.expired) {
        await this.rotateSession(session.id);
      }
    }
  }
  
  private async recoverSession(sessionId: string): Promise<void> {
    // Close broken session, create new one
    // Emit WebSocket event for UI update
  }
}
```

### 5.3 Frontend Components

#### 5.3.1 Room List Component

**Features:**
- List all rooms with unread counts
- Room selection
- Create new room (admin only)

#### 5.3.2 Chat View Component

**Features:**
- Message list with virtual scrolling
- Message input with send button
- Agent avatars and names
- Real-time updates via WebSocket
- Mobile-optimized (bottom nav, touch targets)

#### 5.3.3 Agent Management Component

**Features:**
- Agent list with personality preview
- Add/edit/remove agents
- Relationship editor
- Personality trait sliders

---

## 6. Data Architecture

### 6.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA MODEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐           │
│  │   Room   │1──────*│  Agent   │1──────*│Relationship│           │
│  ├──────────┤         ├──────────┤         ├──────────┤           │
│  │ id       │         │ id       │         │ id       │           │
│  │ name     │         │ roomId   │◄────────│ agentAId │           │
│  │ desc     │         │ name     │         │ agentBId │           │
│  │ settings │         │ role     │         │ type     │           │
│  │ createdAt│         │ avatar   │         │ strength │           │
│  └──────────┘         │ persona  │         │ createdAt│           │
│       │               │ settings │         └──────────┘           │
│       │1              ├──────────┤                                  │
│       │               │ talkative│                                  │
│       │               │ empathy  │                                  │
│       │               │ curiosity│                                  │
│       │               └──────────┘                                  │
│       │                    │                                        │
│       │1                   │1                                       │
│       │                    │                                        │
│       ▼*                   ▼*                                       │
│  ┌──────────┐         ┌──────────┐                                  │
│  │ Message  │         │Discussion│                                  │
│  ├──────────┤         ├──────────┤                                  │
│  │ id       │         │ id       │                                  │
│  │ roomId   │         │ roomId   │                                  │
│  │ agentId  │         │ topic    │                                  │
│  │ role     │         │ heat     │                                  │
│  │ content  │         │ status   │                                  │
│  │ metadata │         │ createdAt│                                  │
│  │ createdAt│         └──────────┘                                  │
│  └──────────┘                                                       │
│                                                                     │
│  ┌──────────┐                                                       │
│  │ Session  │                                                       │
│  ├──────────┤                                                       │
│  │ id       │                                                       │
│  │ roomId   │                                                       │
│  │ gatewayId│                                                       │
│  │ status   │                                                       │
│  │ lastUsed │                                                       │
│  │ createdAt│                                                       │
│  └──────────┘                                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Prisma Schema (Core Models)

```prisma
model Room {
  id          String   @id @default(cuid())
  name        String
  description String?
  settings    Json     @default("{}")
  agents      Agent[]
  messages    Message[]
  discussions Discussion[]
  sessions    Session[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Agent {
  id            String       @id @default(cuid())
  roomId        String
  room          Room         @relation(fields: [roomId], references: [id])
  name          String
  role          String
  avatar        String?
  persona       String?
  talkativeness Int          @default(5)
  empathy       Int          @default(5)
  curiosity     Int          @default(5)
  settings      Json         @default("{}")
  messages      Message[]
  relationshipsAsA Relationship[] @relation("AgentA")
  relationshipsAsB Relationship[] @relation("AgentB")
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([roomId, name])
}

model Relationship {
  id        String   @id @default(cuid())
  agentAId  String
  agentA    Agent    @relation("AgentA", fields: [agentAId], references: [id])
  agentBId  String
  agentB    Agent    @relation("AgentB", fields: [agentBId], references: [id])
  type      String   // e.g., "parent-child", "spouse", "sibling", "friend"
  strength  Int      @default(5) // 1-10
  createdAt DateTime @default(now())

  @@unique([agentAId, agentBId])
}

model Message {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  agentId   String?
  agent     Agent?   @relation(fields: [agentId], references: [id])
  role      String   // "user" | "assistant" | "system"
  content   String
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  @@index([roomId, createdAt])
}

model Discussion {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  topic     String
  heat      Int      @default(0) // 0-100
  status    String   @default("active") // "active" | "archived"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([roomId, heat])
}

model Session {
  id         String   @id @default(cuid())
  roomId     String   @unique
  room       Room     @relation(fields: [roomId], references: [id])
  gatewayId  String   // OpenClaw Gateway session ID
  status     String   @default("active") // "active" | "expired" | "closed"
  lastUsed   DateTime @default(now())
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### 6.3 Data Flow

**6.3.1 Message Creation Flow**

```
User Input
    │
    ▼
┌─────────────────┐
│ Frontend        │
│ (POST /api/     │
│  messages)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Message Service │
│ - Validate      │
│ - Save to DB    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ WebSocket Emit  │
│ (message:new)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OpenClaw        │
│ Service         │
│ - Select agent  │
│ - Build context │
│ - Send to GW    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Response  │
│ - Save to DB    │
│ - Emit WS event │
└─────────────────┘
```

**6.3.2 Webhook Inbound Flow**

```
Feishu User
    │
    ▼
┌─────────────────┐
│ OpenClaw        │
│ Gateway         │
└────────┬────────┘
         │ Webhook POST
         ▼
┌─────────────────┐
│ Webhook         │
│ Endpoint        │
│ - Verify token  │
│ - Parse payload │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Message Service │
│ - Create msg    │
│ - Trigger agent │
└─────────────────┘
```

---

## 7. API Architecture

### 7.1 REST API Endpoints

#### 7.1.1 Rooms

```
GET    /api/rooms              - List all rooms
POST   /api/rooms              - Create room
GET    /api/rooms/:id          - Get room details
PUT    /api/rooms/:id          - Update room
DELETE /api/rooms/:id          - Delete room
GET    /api/rooms/:id/messages - Get room messages
POST   /api/rooms/:id/agents   - Add agent to room
DELETE /api/rooms/:id/agents/:agentId - Remove agent
```

#### 7.1.2 Agents

```
GET    /api/agents             - List all agents
POST   /api/agents             - Create agent
GET    /api/agents/:id         - Get agent details
PUT    /api/agents/:id         - Update agent
DELETE /api/agents/:id         - Delete agent
GET    /api/agents/:id/relationships - Get agent relationships
POST   /api/agents/:id/relationships - Create relationship
```

#### 7.1.3 Messages

```
POST   /api/messages           - Create message (user or assistant)
GET    /api/messages/:id       - Get message details
PUT    /api/messages/:id       - Update message
DELETE /api/messages/:id       - Delete message
```

#### 7.1.4 Webhooks

```
POST   /api/webhooks/openclaw  - OpenClaw webhook endpoint
```

#### 7.1.5 Health

```
GET    /health                 - Health check
GET    /health/ready           - Readiness check
GET    /health/live            - Liveness check
```

### 7.2 WebSocket Events

#### 7.2.1 Client → Server

```typescript
// Join a room
socket.emit('room:join', { roomId: string });

// Leave a room
socket.emit('room:leave', { roomId: string });

// Send message (alternative to REST)
socket.emit('message:send', {
  roomId: string,
  content: string,
  role: 'user' | 'assistant'
});
```

#### 7.2.2 Server → Client

```typescript
// New message in room
socket.on('message:new', (message: Message));

// Message updated
socket.on('message:updated', (message: Message));

// Message deleted
socket.on('message:deleted', (messageId: string));

// Agent started typing
socket.on('agent:typing', { roomId: string, agentId: string });

// Agent stopped typing
socket.on('agent:stop_typing', { roomId: string, agentId: string });

// Session health update
socket.on('session:recovered', { roomId: string, newSessionId: string });
socket.on('session:recovery_failed', { roomId: string, error: string });

// Discussion heat update
socket.on('discussion:heat_updated', { roomId: string, heat: number });
```

### 7.3 API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-26T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "MESSAGE_NOT_FOUND",
    "message": "Message with ID 'xyz' not found",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-03-26T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

---

## 8. Integration Architecture

### 8.1 OpenClaw Integration (Protocol Decision)

**Primary Protocols:**

| Direction | Protocol | Implementation | Status |
|-----------|----------|----------------|--------|
| **OpenClaw → Agent Hub** | **Webhook (HTTP POST)** | `/api/webhooks/openclaw` | ✅ Primary |
| **Agent Hub → OpenClaw** | **CLI (Process Spawn)** | `openclaw agent --message` | ✅ Primary |
| Agent Hub → OpenClaw | HTTP API | Not implemented | ❌ Deferred |
| Agent Hub → OpenClaw | WebSocket | Not implemented | ❌ Not Used |

---

### 8.2 Inbound Integration: Webhook Protocol

**Protocol:** HTTP POST + JSON  
**Endpoint:** `POST /api/webhooks/openclaw`  
**Port:** 4000 (Agent Hub Backend)

#### 8.2.1 OpenClaw Configuration

```json
{
  "channels": {
    "feishu": {
      "connectionMode": "webhook",
      "webhookPath": "/api/webhooks/openclaw",
      "webhookHost": "localhost",
      "webhookPort": 4000,
      "verificationToken": "your-secret-token"
    }
  }
}
```

#### 8.2.2 Webhook Payload Format

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

#### 8.2.3 Webhook Handler Pseudo Code

```
POST /api/webhooks/openclaw
│
├─ 1. Verify authentication token (header: x-openclaw-token)
│   └─ If invalid → Return 401 Unauthorized
│
├─ 2. Validate payload structure
│   ├─ Required: message.content, chatId
│   └─ If invalid → Return 400 Bad Request
│
├─ 3. Save message to database
│   ├─ Table: messages
│   ├─ Fields: roomId, content, role, metadata
│   └─ Store: channelId, accountId, messageId, sender info
│
├─ 4. Emit WebSocket event
│   ├─ Event: message:new
│   ├─ Room: chatId
│   └─ Payload: saved message object
│
├─ 5. Trigger agent response (async, non-blocking)
│   └─ Background task: triggerAgentResponse(chatId, content)
│
└─ 6. Return acknowledgment
    └─ Response: 200 OK { status: "ok", messageId: "..." }
```

#### 8.2.4 Webhook Authentication Interface

```
Interface: WebhookAuthMiddleware
│
├─ Input: HTTP Request
│   ├─ Headers: x-openclaw-token
│   └─ Body: WebhookPayload
│
├─ Process:
│   ├─ Extract token from header
│   ├─ Compare with env: OPENCLAW_VERIFICATION_TOKEN
│   └─ If match → Proceed, else → Reject
│
└─ Output:
    ├─ Valid → Next middleware
    └─ Invalid → 401 Unauthorized { error, code }
```

#### 8.2.5 Webhook Error Handling

| Error | HTTP Code | Response |
|-------|-----------|----------|
| Invalid token | 401 | `{"error": "Unauthorized"}` |
| Invalid payload | 400 | `{"error": "Invalid payload"}` |
| Server error | 500 | `{"error": "Internal server error"}` |
| Success | 200 | `{"status": "ok", "messageId": "..."}` |

---

### 8.3 Outbound Integration: CLI Protocol

**Protocol:** Process Spawn + stdout capture  
**Command:** `openclaw agent --message`  
**Runtime:** Node.js `child_process.exec`

#### 8.3.1 CLI Command Format

```bash
# Basic usage
openclaw agent \
  --message "Dinner tonight?" \
  --agent "mom" \
  --session "family-room"

# With context (if supported)
openclaw agent \
  --message "Dinner tonight?" \
  --agent "mom" \
  --session "family-room" \
  --context "{\"relationships\":[\"spouse\",\"parent\"],\"topic\":\"food\"}"
```

#### 8.3.2 CLI Service Interface

```
Interface: OpenClawService
│
├─ Method: sendMessage(message, agentName, sessionId)
│   ├─ Input:
│   │   ├─ message: string (user message text)
│   │   ├─ agentName: string (agent identifier)
│   │   └─ sessionId: string (room/session ID)
│   │
│   ├─ Process:
│   │   ├─ Build CLI command: openclaw agent --message --agent --session
│   │   ├─ Escape special characters in message
│   │   ├─ Execute command via child_process
│   │   └─ Capture stdout (AI response text)
│   │
│   └─ Output:
│       ├─ Success: string (AI response text)
│       └─ Error: Exception with error details
│
└─ Error Handling:
    ├─ Command not found → Log error, throw exception
    ├─ Timeout (>30s) → Kill process, retry once
    ├─ Non-zero exit → Log stderr, throw exception
    └─ Empty response → Log warning, return default
```

#### 8.3.3 Agent Response Flow Pseudo Code

```
Function: triggerAgentResponse(roomId, userMessage)
│
├─ 1. Query agents in room
│   └─ SELECT * FROM agents WHERE roomId = ?
│
├─ 2. Select responding agent
│   └─ MVP: Random selection from agent list
│
├─ 3. Build agent context
│   ├─ Load agent persona and traits
│   ├─ Load agent relationships
│   ├─ Fetch room context (topic, recent activity)
│   └─ Fetch recent message history (last 10 messages)
│
├─ 4. Call OpenClawService.sendMessage()
│   ├─ Input: userMessage, agentName, roomId
│   └─ Output: AI response text
│
├─ 5. Save AI response to database
│   ├─ Table: messages
│   ├─ Fields: roomId, content, role="assistant", agentId
│   └─ Persist to SQLite
│
└─ 6. Emit WebSocket event
    ├─ Event: message:new
    ├─ Room: roomId
    └─ Payload: AI response message object
```

#### 8.3.4 CLI Error Handling

| Error | Handling |
|-------|----------|
| Command not found | Log error, return mock response (dev only) |
| Timeout (>30s) | Kill process, log timeout, retry once |
| Non-zero exit code | Log stderr, throw error |
| Empty response | Log warning, return "No response" |

#### 8.3.5 CLI Performance Considerations

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Process spawn overhead | ~100-200ms per request | Acceptable for MVP (<1 msg/sec) |
| Concurrent requests | Limited by CPU | Queue system for production |
| Memory usage | Low (process exits) | No cleanup needed |

---

### 8.4 Protocol Comparison

| Aspect | Webhook (Inbound) | CLI (Outbound) |
|--------|-------------------|----------------|
| **Protocol** | HTTP POST + JSON | Process spawn + stdout |
| **Direction** | OpenClaw → Agent Hub | Agent Hub → OpenClaw |
| **Speed** | Fast (~50ms) | Moderate (~150ms) |
| **Complexity** | Low (HTTP handler) | Low (exec call) |
| **Reliability** | High (official API) | High (CLI stable) |
| **Scalability** | High (stateless) | Moderate (process limit) |
| **Debugging** | Easy (HTTP logs) | Easy (stdout/stderr) |
| **Auth** | Token header | N/A (local CLI) |

---

### 8.5 Future Protocol Evolution

**Phase 2 (Performance Optimization):**
- Replace CLI with HTTP API (if OpenClaw exposes stable REST API)
- Add request queuing for concurrent CLI calls
- Implement circuit breaker for OpenClaw failures

**Phase 3 (Production Hardening):**
- Add webhook retry logic (if OpenClaw supports it)
- Implement webhook signature verification (HMAC)
- Add CLI timeout and retry configuration

### 8.2 Session Management

**8.2.1 Session Lifecycle**

```
┌─────────────────┐
│ Room Created    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Created │◄──────┐
│ (OpenClaw GW)   │       │
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│ Active          │───────┘
│ - Messages sent │  Periodic check
│ - Heat tracked  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Expired │
│ (max age: 1h)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Rotated │
│ (new session)   │
└─────────────────┘
```

**8.2.2 Session Guardian Implementation**

```
Component: SessionGuardian
│
├─ Configuration:
│   ├─ checkInterval: 30 seconds
│   └─ sessionMaxAge: 1 hour
│
├─ Method: start()
│   └─ Start periodic check loop (every 30s)
│
└─ Method: checkAllSessions()
    ├─ Query: SELECT * FROM sessions WHERE status = 'active'
    ├─ For each session:
    │   ├─ Check health (via OpenClaw sessions_list)
    │   ├─ If unhealthy → recoverSession()
    │   └─ If expired → rotateSession()
  
  private async checkSessionHealth(session: Session): Promise<SessionHealth> {
    // Pseudo code: Use OpenClaw sessions_list tool
    sessions = exec('openclaw sessions list')
    found = sessions.includes(session.gatewayId)
    return { healthy: found, expired: isSessionExpired(session) }
  }
  
  private async recoverSession(session: Session): Promise<void> {
    // Pseudo code: Recovery flow
    log('Recovering session', session.id)
    update session status to 'closed'
    create new session for room
    emit WebSocket event: session:recovered
  }
  
  private isSessionExpired(session: Session): boolean {
    age = now() - session.lastUsed
    return age > sessionMaxAge (1 hour)
  }
}
```

---

## 9. Security Architecture

### 9.1 Threat Model

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| Unauthorized API access | High | Medium | Token-based auth (future) |
| Webhook spoofing | High | Low | Verification token |
| Session hijacking | Medium | Low | Session rotation |
| Data leakage | Medium | Low | Local-only deployment |
| DoS attack | Low | Low | Rate limiting (future) |

### 9.2 Security Controls

**9.2.1 Webhook Verification**

```
Interface: WebhookVerification
│
├─ Input: HTTP Request headers
│   └─ Header: x-openclaw-token
│
├─ Process:
│   ├─ Extract token from header
│   ├─ Compare with env: OPENCLAW_VERIFICATION_TOKEN
│   └─ If mismatch → Throw error
│
└─ Output: boolean (true if valid)
```

**9.2.2 Input Validation Schema**

```
Schema: CreateMessageRequest
│
├─ roomId: string (CUID format, required)
├─ content: string (1-10000 chars, required)
├─ role: enum ['user', 'assistant', 'system'] (required)
└─ agentId: string (CUID format, optional for assistant messages)
```

**9.2.3 Database Security**

| Control | Implementation |
|---------|----------------|
| File permissions | `chmod 600 dev.db` (owner read/write only) |
| Network access | Local-only (no external connections) |
| SQL injection | Prevented via Prisma ORM (prepared statements) |
| Encryption | At-rest encryption (future: SQLite encrypted extension) |

### 9.3 Privacy Considerations

- All data stored locally (user controls access)
- No cloud transmission (except OpenClaw Gateway)
- No analytics/tracking
- Conversation history retained indefinitely (user can delete)

---

## 10. Deployment Architecture

### 10.1 Local Deployment (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Machine                           │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Frontend      │  │   Backend       │                  │
│  │   (Next.js)     │  │   (Express)     │                  │
│  │   Port 3000     │  │   Port 4000     │                  │
│  └─────────────────┘  └────────┬────────┘                  │
│                                │                            │
│                                ▼                            │
│                       ┌─────────────────┐                   │
│                       │   SQLite DB     │                   │
│                       │   (file)        │                   │
│                       └─────────────────┘                   │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   OpenClaw      │  │   Feishu        │                  │
│  │   Gateway       │  │   Client        │                  │
│  │   Port 18789    │  │   (Mobile)      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Startup Sequence

```bash
# 1. Start OpenClaw Gateway (if not running)
openclaw gateway start

# 2. Start Agent Hub Backend
cd ~/agent-hub
npm run dev:server  # Port 4000

# 3. Start Agent Hub Frontend
cd ~/agent-hub/client
npm run dev  # Port 3000

# 4. Configure OpenClaw webhook
# (via OpenClaw config or CLI)
```

### 10.3 Environment Variables

```bash
# .env.example

# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="file:./prisma/dev.db"

# OpenClaw
OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
OPENCLAW_VERIFICATION_TOKEN="your-secret-token"
OPENCLAW_WEBHOOK_PATH="/api/webhooks/openclaw"

# Session Guardian
SESSION_CHECK_INTERVAL=30000
SESSION_MAX_AGE=3600000

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:4000"
```

### 10.4 Process Management

**Development:**
```bash
# Use tsx watch for auto-reload
npx tsx watch server/src/index.ts
```

**Production (future):**
```bash
# Use PM2 or systemd
pm2 start server/src/index.ts --name agent-hub
pm2 save
```

---

## 11. Scalability and Performance

### 11.1 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Message latency (P95) | < 3s | TBD |
| API response time (P95) | < 200ms | TBD |
| WebSocket message delivery | < 100ms | TBD |
| Concurrent users | 10+ | 1 (MVP) |
| Messages per second | 10+ | 1 (MVP) |

### 11.2 Bottleneck Analysis

**Current Bottlenecks:**
1. OpenClaw Gateway response time (external dependency)
2. Agent selection algorithm (future complexity)
3. Database writes (SQLite, single-threaded)

**Mitigation Strategies:**
1. Async agent responses (non-blocking)
2. Caching for frequently accessed data
3. Connection pooling (if upgrading to PostgreSQL)

### 11.3 Scaling Path

**Phase 1 (MVP):** Single-user, local deployment
- SQLite database
- Single backend instance
- No load balancing

**Phase 2 (Multi-user):** Add authentication
- PostgreSQL database
- Session management
- User isolation

**Phase 3 (Multi-tenant):** Cloud deployment
- Container orchestration (Docker/K8s)
- Load balancing
- Horizontal scaling

---

## 12. Evolution Roadmap

### 12.1 Phase 1: Core Infrastructure (Current)

**Timeline:** Week 1-2  
**Status:** In Progress

**Deliverables:**
- ✅ Backend API (Express + TypeScript)
- ✅ Database schema (Prisma + SQLite)
- ✅ WebSocket real-time messaging
- ⏳ OpenClaw webhook integration
- ⏳ Session Guardian Service
- ✅ Basic frontend (Next.js)

**Success Criteria:**
- Messages persist to database
- Real-time updates via WebSocket
- OpenClaw integration working
- Session auto-recovery functional

### 12.2 Phase 2: Agent Intelligence

**Timeline:** Week 3-4  
**Status:** Planned

**Deliverables:**
- Agent selection algorithm (v2 scoring)
- Discussion heat system
- Topic auto-triggering
- Agent memory windows
- Personality-driven responses

**Success Criteria:**
- Natural conversation flow
- Agents respond contextually
- Heat system prevents spam

### 12.3 Phase 3: Multi-Room & Management

**Timeline:** Week 5-6  
**Status:** Planned

**Deliverables:**
- Multiple room support
- Agent management UI
- Relationship editor
- Room settings
- Mobile app optimization

**Success Criteria:**
- Users can create/manage rooms
- Mobile UX is smooth
- All MVP features complete

### 12.4 Future Enhancements (Post-MVP)

- Multi-user authentication
- Cloud deployment option
- Voice message support
- Agent learning/adaptation
- Advanced analytics
- Integration with other platforms (WhatsApp, Telegram)

---

## 13. Appendices

### 13.1 Glossary

| Term | Definition |
|------|------------|
| Room | A conversation space containing multiple agents |
| Agent | An AI persona with personality and relationships |
| Relationship | Connection between two agents (e.g., parent-child) |
| Discussion | A topic thread within a room |
| Heat | A score (0-100) indicating discussion activity |
| Session | An OpenClaw Gateway conversation session |
| Session Guardian | Service that monitors and recovers sessions |

### 13.2 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Webhook over WebSocket | Official OpenClaw API, stable |
| 2026-03-26 | SQLite over PostgreSQL | Local-first, no infrastructure |
| 2026-03-26 | Random agent selection (MVP) | Simplicity, iterate later |
| 2026-03-26 | Single admin user | Avoid auth complexity for MVP |
| **2026-03-27** | **CLI + Webhook protocols** | **CLI: simple, works immediately. Webhook: official API, stable** |
| **2026-03-27** | **No WebSocket for OpenClaw** | **Undocumented protocol, encountered "invalid request frame" errors** |

### 13.3 Open Questions

1. **Agent Selection Algorithm**: What's the optimal weighting for topic, relationship, personality, and heat?
2. **Session Rotation**: Should sessions rotate on time-based or activity-based triggers?
3. **Heat Decay**: How quickly should discussion heat decay over time?
4. **Memory Window**: How many messages should each agent remember?

### 13.4 References

- [OpenClaw Documentation](https://docs.openclaw.ai)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Express.js Documentation](https://expressjs.com/)

---

## Document Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Architect | Architect | 2026-03-26 | ✅ Approved |
| Tech Lead | - | - | ⏳ Pending |
| Product | - | - | ⏳ Pending |

---

**This document is the single source of truth for Agent Hub development. All implementation must align with this architecture.**

_Last Updated: 2026-03-26_
