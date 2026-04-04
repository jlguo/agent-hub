# Agent Hub - Technical Design Documents Index

**Last Updated:** 2026-04-04  
**Purpose:** Quick reference to all architectural and technical design documents

---

## 📚 Core Architecture Documents

### 1. ARCHITECTURE.md (64KB) - **Authoritative Source of Truth**

**Location:** `/home/jlguo/agent-hub/ARCHITECTURE.md`  
**Date:** 2026-03-26  
**Status:** Complete & Authoritative

**Contents:**

- System overview and vision
- Architecture principles
- System context diagrams
- Component architecture
- Data architecture (Prisma schema)
- API architecture
- Security architecture
- Deployment architecture
- Scalability & performance

**Key Sections:**

- Section 4: System Context (Web UI + Feishu flows)
- Section 6: Data Architecture (Room, Agent, Message, Discussion models)
- Section 10: Deployment Architecture (Local → Docker → K8s)

---

## 🎯 Production Design Documents

### 2. P0-PRODUCTION-DESIGN.md (41KB) - Kubernetes Deployment

**Location:** `/home/jlguo/agent-hub/docs/P0-PRODUCTION-DESIGN.md`  
**Date:** 2026-04-01  
**Priority:** P0 (Critical)

**Contents:**

- Kubernetes cluster options (managed vs self-hosted)
- Helm chart architecture
- Monitoring stack (Prometheus + Grafana + Sentry)
- HorizontalPodAutoscaler configuration
- NetworkPolicy security
- Database strategy (SQLite PVC vs PostgreSQL)
- Ingress + SSL (Nginx + cert-manager)
- Cost analysis ($59/month for 3-node cluster)

**Key Diagrams:**

- High-level K8s architecture
- Monitoring stack integration
- GitOps deployment flow

---

### 3. P1-TECHNICAL-DESIGN.md (36KB) - UX Features

**Location:** `/home/jlguo/agent-hub/docs/P1-TECHNICAL-DESIGN.md`  
**Date:** 2026-04-01  
**Priority:** P1 (Important)

**Contents:**

- Typing indicators (WebSocket events + UI component)
- Message read receipts (database schema + API)
- Admin dashboard (JWT auth + monitoring UI)
- System health monitoring
- Room/agent management interface

**Features:**

- TypingIndicator.tsx component
- UnreadBadge component
- Admin dashboard at /admin
- Relationship editor UI

---

## 🔧 Technical Design Documents

### 4. M4-PHASE1-TECHNICAL-DESIGN.md (16KB) - Test Infrastructure

**Location:** `/home/jlguo/agent-hub/docs/M4-PHASE1-TECHNICAL-DESIGN.md`  
**Date:** 2026-04-02  
**Status:** ✅ COMPLETE (63/63 tests passing)

**Contents:**

- Jest + TypeScript configuration
- Test database setup (isolated SQLite)
- Test factories (Agent, Message, Room)
- Unit test patterns
- Coverage targets (85% overall)

**Results:**

- 63 unit tests implemented
- 100% pass rate
- ~40% coverage achieved

---

### 5. M4-PHASE5-TECHNICAL-DESIGN.md (18KB) - Test Enforcement

**Location:** `/home/jlguo/agent-hub/docs/M4-PHASE5-TECHNICAL-DESIGN.md`  
**Date:** 2026-04-02  
**Status:** ✅ COMPLETE

**Contents:**

- Pre-commit hooks (Husky + lint-staged)
- CI/CD pipeline (GitHub Actions)
- Coverage enforcement script
- PR quality gates
- Codecov integration

**Implementation:**

- `.husky/pre-commit` hook
- `.github/workflows/ci.yml`
- `scripts/check-coverage.ts`
- ESLint + Prettier configuration

---

### 6. OPENCLAW-DUAL-MODE-DESIGN.md (12KB)

**Location:** `/home/jlguo/agent-hub/docs/OPENCLAW-DUAL-MODE-DESIGN.md`  
**Date:** 2026-04-02  
**Status:** ⚠️ Partial Implementation

**Contents:**

- CLI mode (original implementation)
- HTTP API mode design
- Mode switching configuration
- Authentication middleware

**Current Status:**

- ✅ CLI mode: Working perfectly
- ⚠️ HTTP API mode: Incompatible with OpenClaw Gateway (uses WebSocket, not REST)
- **Recommendation:** Use CLI mode for production

---

## 📋 Deployment Guides

### 7. PHASE2-DEPLOYMENT-GUIDE.md (9.3KB)

**Location:** `/home/jlguo/agent-hub/docs/PHASE2-DEPLOYMENT-GUIDE.md`  
**Date:** 2026-04-03  
**Status:** ✅ Complete

**Contents:**

- Quick start (3 deployment options)
- Docker file explanations
- docker-compose.yml configuration
- Helm chart usage
- Environment variables
- Health checks
- Scaling strategies
- Backup & recovery
- Security hardening
- Troubleshooting guide

**Deployment Options:**

1. Docker Compose (local testing)
2. Local Kubernetes (Docker Desktop)
3. Production Kubernetes (cloud provider)

---

### 8. DOCKER-DEV-PROGRESS.md (4.8KB)

**Location:** `/home/jlguo/agent-hub/DOCKER-DEV-PROGRESS.md`  
**Date:** 2026-04-04  
**Status:** Current

**Contents:**

- What's working (95%)
- What's missing (5% - OpenClaw integration)
- Test results summary
- Recommendations for dev vs production

**Current Status:**

- ✅ Frontend: 100% working
- ✅ Backend: 100% working
- ✅ Docker: Both containers healthy
- ✅ E2E Tests: 2/4 passing (UI tests)
- ⚠️ Agent Responses: Need OpenClaw CLI or WebSocket Gateway

---

## 📊 Progress Tracking

### 9. MILESTONES.md (20KB)

**Location:** `/home/jlguo/agent-hub/docs/MILESTONES.md`  
**Date:** 2026-04-04  
**Status:** Active

**Contents:**

- 7 Milestones with phases
- Must-Have/Should-Have/Nice-to-Have priorities
- Progress tracking per milestone
- Dependencies between milestones
- Reference docs linked

**Current Status:**

- ✅ Milestone 1: Core Infrastructure (COMPLETE)
- ✅ Milestone 2: Agent Intelligence (COMPLETE)
- 🔄 Milestone 3: Production Readiness (95% complete)
- 🔄 Milestone 4: Test Quality (67% complete - 67/110 tests)
- ⏳ Milestone 5+: Future enhancements

---

### 10. PHASE2-PROGRESS.md (7.1KB)

**Location:** `/home/jlguo/agent-hub/docs/PHASE2-PROGRESS.md`  
**Date:** 2026-04-03  
**Status:** Active

**Contents:**

- Task checklists
- Testing procedures
- Risk register
- 7-day timeline
- Definition of Done
- Next 24-hour action plan

---

## 🎓 Lessons Learned

### 11. LESSONS-LEARNED.md (10.8KB)

**Location:** `/home/jlguo/agent-hub/docs/LESSONS-LEARNED.md`  
**Date:** 2026-04-03  
**Status:** Complete

**Contents:**

- Architecture & Design (3 lessons)
- Testing & Quality (3 lessons)
- Integration Patterns (3 lessons)
- Docker & Deployment (3 lessons)
- Code Quality (3 lessons)
- Production Readiness (3 lessons)
- Common Pitfalls table (10 issues/solutions)

**Key Lessons:**

1. docker-compose.yml healthcheck overrides Dockerfile HEALTHCHECK
2. NEXT*PUBLIC*\* variables bake at build time, not runtime
3. Docker containers must use service names for inter-container communication
4. Always use 127.0.0.1 instead of localhost in Docker health checks

---

## 🔍 Quick Reference by Topic

### Architecture Overview

→ **ARCHITECTURE.md** (Section 1-4)

### Database Schema

→ **ARCHITECTURE.md** (Section 6)  
→ **SCHEMA-REVIEW.md** (detailed analysis)

### Deployment

→ **PHASE2-DEPLOYMENT-GUIDE.md** (quick start)  
→ **P0-PRODUCTION-DESIGN.md** (Kubernetes deep dive)  
→ **DOCKER-DEV-PROGRESS.md** (current status)

### Testing

→ **M4-PHASE1-TECHNICAL-DESIGN.md** (test infrastructure)  
→ **M4-PHASE5-TECHNICAL-DESIGN.md** (enforcement)  
→ **skills/test-writing-rules/SKILL.md** (project skill)

### OpenClaw Integration

→ **ARCHITECTURE.md** (Section 8)  
→ **OPENCLAW-DUAL-MODE-DESIGN.md** (dual-mode design)

### UX Features

→ **P1-TECHNICAL-DESIGN.md** (typing, read receipts, admin dashboard)

### Project Progress

→ **MILESTONES.md** (comprehensive tracking)  
→ **PHASE2-PROGRESS.md** (current phase details)

### Troubleshooting

→ **LESSONS-LEARNED.md** (common pitfalls)  
→ **TROUBLESHOOTING-GUIDE.md** (15 issues with solutions)

---

## 📁 Document Locations

```
/home/jlguo/agent-hub/
├── ARCHITECTURE.md                    # Core architecture (64KB)
├── README.md                          # Project overview (13KB)
├── STATUS.md                          # Current status (5.7KB)
├── QUICK-REFERENCE.md                 # Quick reference (5.4KB)
├── TROUBLESHOOTING-GUIDE.md           # 15 issues (17KB)
├── DOCKER-DEV-PROGRESS.md             # Docker status (4.8KB)
├── docs/
│   ├── MILESTONES.md                  # Project tracking (20KB)
│   ├── PHASES.md                      # Development phases (6.4KB)
│   ├── FEATURES.md                    # Feature specs (11KB)
│   ├── P0-PRODUCTION-DESIGN.md        # K8s deployment (41KB)
│   ├── P1-TECHNICAL-DESIGN.md         # UX features (36KB)
│   ├── M4-PHASE1-TECHNICAL-DESIGN.md  # Test infrastructure (16KB)
│   ├── M4-PHASE5-TECHNICAL-DESIGN.md  # Test enforcement (18KB)
│   ├── OPENCLAW-DUAL-MODE-DESIGN.md   # Dual-mode design (12KB)
│   ├── PHASE2-DEPLOYMENT-GUIDE.md     # Deployment guide (9.3KB)
│   ├── PHASE2-PROGRESS.md             # Phase 2 tracker (7.1KB)
│   ├── LESSONS-LEARNED.md             # Lessons (10.8KB)
│   └── ARCHIVE/                       # Historical docs
└── skills/
    └── test-writing-rules/
        └── SKILL.md                   # Test writing skill (17KB)
```

---

## 🎯 Recommended Reading Order

### For New Developers

1. **README.md** - Project overview
2. **ARCHITECTURE.md** (Section 1-4) - System context
3. **QUICK-REFERENCE.md** - Key commands
4. **PHASE2-DEPLOYMENT-GUIDE.md** - Getting started

### For Production Deployment

1. **P0-PRODUCTION-DESIGN.md** - Kubernetes architecture
2. **PHASE2-DEPLOYMENT-GUIDE.md** - Step-by-step guide
3. **LESSONS-LEARNED.md** - Common pitfalls
4. **TROUBLESHOOTING-GUIDE.md** - Problem solving

### For Test Writing

1. **skills/test-writing-rules/SKILL.md** - Project skill (enforced)
2. **M4-PHASE1-TECHNICAL-DESIGN.md** - Test infrastructure
3. **M4-PHASE5-TECHNICAL-DESIGN.md** - Enforcement mechanisms
4. **LESSONS-LEARNED.md** - Testing lessons

### For Feature Development

1. **ARCHITECTURE.md** (relevant sections) - System design
2. **P1-TECHNICAL-DESIGN.md** - UX patterns
3. **MILESTONES.md** - Current priorities
4. **FEATURES.md** - Existing features

---

**Last Review:** 2026-04-04  
**Next Review:** After Milestone 4 completion
