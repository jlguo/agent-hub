# Agent Hub Project - Lessons Learned

_Comprehensive documentation of all technical lessons, patterns, and pitfalls discovered during Agent Hub development (March-April 2026)_

---

## 🏗️ Architecture & Design

### 1. Single Source of Truth

**Lesson:** Database is the authoritative source for all messages and state.

**Implementation:**

- All messages persist to database FIRST, then broadcast via WebSocket
- Backend is central hub - Feishu and Web UI both talk to backend, never directly to each other
- Discussion-based context - Agents use last 20 messages from discussion, not session-based

**Why it matters:** Prevents data loss, enables failover, ensures consistency across clients.

---

### 2. Agent Selection Intelligence

**Lesson:** Heat-based probability + @mention priority creates natural conversation flow.

**Implementation:**

- Heat system: 60% response probability per message, builds with activity
- @Mention 100% priority - Mentioned agents respond immediately (with 60s cooldown)
- Agent-to-agent @mentions - Bro can summon Dad, Mom, etc. with chain reactions
- Relationship-aware prompts - Agents know family tree (27 relationships)

**Why it matters:** Agents respond naturally, not robotically. Family dynamics emerge organically.

---

### 3. Code Organization

**Lesson:** Consolidate documentation and use single workspace.

**Implementation:**

- Keep all docs in `/home/jlguo/agent-hub/` not multiple workspaces
- Consolidated 23 MD files → 5 core files (78% reduction)
- Use `docs/MILESTONES.md` as single source of truth for all planning

**Why it matters:** Reduces confusion, eliminates redundancy, makes onboarding easier.

---

## 🧪 Testing & Quality

### 4. Test Infrastructure

**Lesson:** Project-level skill enforces consistent test standards.

**Implementation:**

- `skills/test-writing-rules/SKILL.md` enforces 12 test writing rules
- `scripts/validate-tests.ts` checks coverage thresholds automatically
- Test factories for Agent, Message, Room (12 reusable functions)
- 79 tests passing - 63 unit + 16 E2E (128% of 60 test target)

**Why it matters:** Automated enforcement prevents test quality degradation.

---

### 5. Coverage Enforcement

**Lesson:** Start with achievable baselines, grow incrementally.

**Implementation:**

- Pre-commit hooks - Husky + lint-staged run before every commit
- CI/CD pipeline - GitHub Actions runs on every PR
- Baseline thresholds - Start low (5-16%), grow with test coverage
- Integration test deferral - Jest + ES modules = compatibility issues, defer to later

**Why it matters:** Prevents coverage from stagnating, catches regressions early.

---

### 6. Jest Configuration

**Lesson:** ES modules + ts-jest = compatibility challenges.

**Implementation:**

- ❌ ES module issues - `import.meta.url` doesn't work with ts-jest
- ✅ Use `process.cwd()` - Compatible with both Jest and production
- ✅ maxWorkers: 1 - Prevents database conflicts in parallel tests
- ✅ Separate test DB - `prisma/test.db` isolated from development data

**Why it matters:** Avoids hours of debugging module resolution issues.

---

## 🔌 Integration Patterns

### 7. Feishu Integration

**Lesson:** Official SDK only, never raw WebSocket.

**Implementation:**

- ✅ Official SDK - `@larksuiteoapi/node-sdk` WSClient
- ✅ Hybrid approach - WebSocket inbound, HTTP API outbound
- ✅ Bidirectional sync - Feishu ↔ Web UI both directions working
- ✅ externalChatId field - Map Feishu chat to database room

**Why it matters:** SDK handles authentication, reconnection, event parsing automatically.

---

### 8. OpenClaw Integration

**Lesson:** CLI mode works reliably, dual-mode for future.

**Implementation:**

- ✅ CLI mode - `openclaw agent --message --agent --session-id`
- ✅ Dual-mode design - Support both CLI and HTTP API (future-proof)
- ✅ Agent name mapping - DB names → OpenClaw IDs (Mom → family-mom)
- ✅ 120s timeout - OpenClaw needs 18-47s typically, 30s too short

**Why it matters:** CLI is stable, HTTP API provides flexibility for advanced use cases.

---

### 9. WebSocket Real-Time

**Lesson:** Emit AFTER save, handle timing carefully.

**Implementation:**

- ✅ Emit AFTER save - Save to database first, then broadcast
- ✅ Deduplication - Check `message.id` before adding to frontend state
- ✅ Room join timing - Client joins room BEFORE expecting messages
- ✅ Agent response emit - Don't forget to emit agent messages to WebSocket!

**Why it matters:** Prevents message loss, duplicates, and race conditions.

---

## 🐳 Docker & Deployment

### 10. Prisma SSL Compatibility

**Lesson:** Prisma version matters for Alpine Linux compatibility.

**Implementation:**

- ❌ Prisma 5.x - Compiled against OpenSSL 1.1 (not available in Alpine 3.18+)
- ✅ Prisma 6.x - Native OpenSSL 3 support without breaking changes
- ✅ Alpine packages - Add `openssl3 libssl3 wget` to Dockerfile
- ✅ npm install > npm ci - More reliable in Docker build context

**Why it matters:** Prevents "libssl.so.1.1: No such file or directory" errors.

---

### 11. Health Check IPv4 Fix

**Lesson:** localhost resolves to IPv6 in Docker containers.

**Implementation:**

- ❌ localhost resolves to IPv6 - `[::1]` in Docker containers
- ✅ Use `127.0.0.1` - Forces IPv4, server listens on `0.0.0.0`
- ✅ docker-compose overrides Dockerfile - Healthcheck in compose.yml takes precedence
- ✅ start_period 30s - Give server time to fully initialize

**Why it matters:** Prevents "unhealthy" container status when server is actually working.

---

### 12. Kubernetes Lessons

**Lesson:** PodSecurity policies are strict in Docker Desktop K8s.

**Implementation:**

- ✅ PodSecurity "restricted" - Requires `seccompProfile.type: RuntimeDefault`
- ❌ hostPath volumes - Violates PodSecurity policy, use PVC instead
- ✅ imagePullPolicy: Never - For local development with local images
- ⚠️ ServiceMonitor CRDs - Not available in Docker Desktop K8s (needs Prometheus Operator)
- ✅ Helm namespace labels - Add `app.kubernetes.io/managed-by: Helm` to avoid ownership conflicts

**Why it matters:** Avoids pod scheduling failures and security policy violations.

---

## 📝 Code Quality

### 13. TypeScript Best Practices

**Lesson:** Null checks and type assertions prevent runtime errors.

**Implementation:**

- ✅ Null checks everywhere - `relationships?.length`, `metadata ?? {}`
- ✅ Type assertions - `as Prisma.AgentSelect` when needed
- ✅ Prisma types - Regenerate after schema changes (`npx prisma generate`)
- ❌ senderId field - Doesn't exist in Message schema, use senderType instead

**Why it matters:** Catches errors at compile time, not production.

---

### 14. Error Handling

**Lesson:** Standardized error handling improves debugging.

**Implementation:**

- ✅ Standardized utility - `server/src/utils/error-handler.ts`
- ✅ Error classification - ValidationError, NotFoundError, etc.
- ✅ Consistent logging - Structured error responses
- ✅ Safe execution - `safeExecute()` wrapper with try-catch

**Why it matters:** Faster debugging, consistent error responses, better monitoring.

---

### 15. Frontend Patterns

**Lesson:** React rendering quirks require specific patterns.

**Implementation:**

- ✅ Composite keys - `${id}-${createdAt}` for React lists
- ✅ Auto-scroll - `useEffect` on `[messages]` change, `scrollTop = scrollHeight`
- ✅ Message ordering - API returns `orderBy: 'desc'`, then `.reverse()` for display
- ✅ senderType not role - Schema changed, update all frontend code

**Why it matters:** Eliminates React warnings, improves UX.

---

## 🚀 Production Readiness

### 16. Monitoring & Alerting

**Lesson:** Baseline performance metrics before production.

**Implementation:**

- ✅ Health endpoints - `/health`, `/health/detailed`, `/metrics`
- ✅ Performance baseline - All DB queries <12ms (excellent)
- ✅ Error tracking - Sentry integration ready
- ✅ Uptime monitoring - UptimeRobot free tier

**Why it matters:** Know what "normal" looks like before issues arise.

---

### 17. Security

**Lesson:** Container security hardening is straightforward.

**Implementation:**

- ✅ Non-root containers - Run as `nodeuser` (UID 1001)
- ✅ Security contexts - Drop capabilities, read-only filesystem
- ✅ JWT auth - Admin routes protected
- ✅ Encryption - AES-256-GCM for sensitive data

**Why it matters:** Reduces attack surface, protects sensitive data.

---

### 18. CI/CD Pipeline

**Lesson:** Automate everything that can be automated.

**Implementation:**

- ✅ GitHub Actions - Runs on push to master and PRs
- ✅ Matrix testing - Node 18.x and 20.x
- ✅ npm cache - Faster installs
- ✅ Coverage reports - HTML reports in `coverage/unit/`

**Why it matters:** Catches issues before production, reduces manual work.

---

## ⚠️ Common Pitfalls Avoided

| Issue                         | Solution                                      |
| ----------------------------- | --------------------------------------------- |
| Duplicate messages            | Deduplication check + single WebSocket source |
| Messages disappear on refresh | API returns newest first + auto-scroll        |
| Agent responses not showing   | Emit agent messages to WebSocket              |
| OpenClaw timeout              | 30s → 120s timeout                            |
| Feishu WebSocket 404          | Raw WebSocket → Official SDK                  |
| Room lookup fails             | `settings` → `externalChatId` field           |
| Prisma SSL error              | Prisma 5.x → 6.x with OpenSSL 3               |
| Health check unhealthy        | `localhost` → `127.0.0.1` (IPv4)              |
| TypeScript build fails        | `import.meta.url` → `process.cwd()`           |
| Integration tests blocked     | Defer to Phase 5, focus on unit + E2E         |

---

## 📊 Project Metrics

| Metric               | Value                       |
| -------------------- | --------------------------- |
| **Total Tests**      | 79 passing (100%)           |
| **Coverage**         | 7.5% baseline (target: 80%) |
| **Services Tested**  | 3/12 (25%)                  |
| **Docker Images**    | 2 (backend + frontend)      |
| **K8s Resources**    | 14 Helm templates           |
| **Documentation**    | 5 core files + 20 docs      |
| **Commits**          | 50+ (clean history)         |
| **Development Time** | ~30 days                    |

---

## 🎯 Key Success Factors

1. **Iterative debugging** - Fix one issue at a time, verify before moving on
2. **Documentation first** - Write tech design before implementation
3. **Test automation** - Pre-commit hooks catch issues early
4. **Single source of truth** - One workspace, one milestone doc, one DB
5. **Hybrid approaches** - WebSocket + HTTP, CLI + API, local + K8s
6. **Community tools** - Official SDKs over custom implementations
7. **Baseline thresholds** - Start achievable, grow incrementally

---

## 📚 Related Documents

- [MILESTONES.md](MILESTONES.md) - Project planning and tracking
- [FEATURES.md](FEATURES.md) - Feature specifications
- [P0-PRODUCTION-DESIGN.md](P0-PRODUCTION-DESIGN.md) - Production architecture
- [TEST-QUALITY-REVIEW-2026-04-02.md](TEST-QUALITY-REVIEW-2026-04-02.md) - Test remediation plan
- [PHASE2-DEPLOYMENT-GUIDE.md](PHASE2-DEPLOYMENT-GUIDE.md) - Deployment instructions

---

**Last Updated:** 2026-04-03  
**Status:** Phase 2 (Production Deployment) ✅ 100% COMPLETE  
**Next:** Milestone 4 (Test Quality) - Target 40% coverage
