# Phase 1: Core Infrastructure Implementation

## Objective
Set up the foundational project structure, database schema, and backend API.

## Tasks

### 1. Project Setup
- [ ] Initialize npm project (package.json)
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Set up monorepo structure (packages/server, packages/client)
- [ ] Add ESLint + Prettier
- [ ] Create .env.example

### 2. Database Schema (Prisma)
- [ ] Install Prisma + SQLite
- [ ] Create schema.prisma with:
  - Room model
  - Agent model
  - Relationship model
  - Message model
  - Discussion model
- [ ] Run initial migration
- [ ] Seed script for demo data (family room with 3-4 agents)

### 3. Backend Server (Express)
- [ ] Express app setup with TypeScript
- [ ] CORS configuration
- [ ] Health check endpoint
- [ ] Error handling middleware

### 4. Room API
- [ ] GET /api/rooms - List all rooms
- [ ] POST /api/rooms - Create room
- [ ] GET /api/rooms/:id - Get room
- [ ] PUT /api/rooms/:id - Update room
- [ ] DELETE /api/rooms/:id - Delete room

### 5. Agent API
- [ ] GET /api/rooms/:roomId/agents - List agents
- [ ] POST /api/rooms/:roomId/agents - Create agent
- [ ] GET /api/rooms/:roomId/agents/:id - Get agent
- [ ] PUT /api/rooms/:roomId/agents/:id - Update agent
- [ ] DELETE /api/rooms/:roomId/agents/:id - Delete agent

### 6. OpenClaw Service
- [ ] WebSocket connection to OpenClaw Gateway
- [ ] Session creation/management
- [ ] Message sending with agent context
- [ ] Session health check

### 7. Session Guardian Service
- [ ] Periodic health check (every 30s)
- [ ] Auto-recovery for broken sessions
- [ ] Session expiration handling
- [ ] WebSocket notifications

## Deliverables
1. Working backend server on port 4000
2. SQLite database with all tables
3. REST API for rooms + agents
4. OpenClaw integration (basic)
5. Session Guardian running

## Acceptance Criteria
- [ ] Can create/list/update/delete rooms via API
- [ ] Can create/list/update/delete agents via API
- [ ] Database has seed data (family room)
- [ ] OpenClaw session created for room
- [ ] Session Guardian monitors and recovers sessions

## Reference
See: AGENT-HUB-ARCHITECTURE.md Sections 2, 3, 4, 5
