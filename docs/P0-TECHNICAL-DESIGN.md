# P0 Production Readiness - Technical Design

**Date**: 2026-03-30  
**Phase**: Phase 3 (Polish & Production)  
**Priority**: P0 (Critical)  
**Estimated Effort**: 16-20 hours total

---

## Overview

P0 focuses on making Agent Hub production-ready with three critical components:

1. **Monitoring & Alerting** - Observability, health checks, error tracking
2. **Rate Limiting & Security** - API protection, authentication, encryption
3. **CI/CD Pipeline** - Automated testing, deployment, migrations

---

## 1. Monitoring & Alerting System

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Agent Hub Backend                      │
├─────────────────────────────────────────────────────────┤
│  Express.js App (port 4000)                             │
│  ├─ Health Check Endpoint (/health)                     │
│  ├─ Metrics Endpoint (/metrics)                         │
│  ├─ Custom Middleware (logging, timing)                 │
│  └─ Error Handler (Sentry integration)                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Monitoring Stack                        │
├─────────────────────────────────────────────────────────┤
│  Prometheus (metrics collection)                        │
│  Grafana (dashboards, visualization)                    │
│  Sentry (error tracking, alerts)                        │
│  Winston (structured logging)                           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Key Metrics to Track

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `http_requests_total` | Counter | Total HTTP requests by route/status | - |
| `http_request_duration_seconds` | Histogram | Request latency percentiles | p95 > 2s |
| `openclaw_cli_duration_seconds` | Histogram | OpenClaw CLI execution time | p95 > 60s |
| `openclaw_cli_errors_total` | Counter | OpenClaw CLI failures | > 5 in 5min |
| `feishu_api_errors_total` | Counter | Feishu API failures | > 5 in 5min |
| `websocket_connections` | Gauge | Active WebSocket connections | < 1 (if expected) |
| `database_query_duration_ms` | Histogram | Prisma query latency | p95 > 500ms |
| `agent_response_time_seconds` | Histogram | Agent selection + response time | p95 > 30s |
| `heat_tracker_decay_errors` | Counter | Heat decay cycle failures | > 0 |
| `message_queue_size` | Gauge | Pending messages to process | > 100 |

### 1.3 Health Check Endpoints

#### `/health` (Simple Health Check)
```typescript
GET /health
Response: 200 OK
{
  "status": "ok",
  "timestamp": "2026-03-30T14:00:00.000Z",
  "uptime": 3600,
  "version": "2.0.0"
}
```

#### `/health/detailed` (Deep Health Check)
```typescript
GET /health/detailed
Response: 200 OK (or 503 if unhealthy)
{
  "status": "ok",
  "timestamp": "2026-03-30T14:00:00.000Z",
  "checks": {
    "database": { "status": "ok", "responseTime": 12 },
    "openclaw": { "status": "ok", "responseTime": 1500 },
    "feishu": { "status": "ok", "responseTime": 200 },
    "websocket": { "status": "ok", "connections": 5 },
    "heatTracker": { "status": "ok", "activeDiscussions": 3 }
  }
}
```

#### `/metrics` (Prometheus Format)
```typescript
GET /metrics
Response: 200 OK (text/plain)
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{route="/api/messages",method="POST",status="200"} 1234
http_requests_total{route="/api/rooms",method="GET",status="200"} 5678

# HELP http_request_duration_seconds Request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/api/messages",le="0.1"} 1000
http_request_duration_seconds_bucket{route="/api/messages",le="0.5"} 1200
http_request_duration_seconds_bucket{route="/api/messages",le="1"} 1230
http_request_duration_seconds_bucket{route="/api/messages",le="+Inf"} 1234
```

### 1.4 Logging Strategy

**Library**: Winston + Morgan (HTTP logging)

**Log Levels**:
- `error`: Application errors (OpenClaw failures, database errors)
- `warn`: Recoverable issues (rate limit hits, cooldown skips)
- `info`: Business events (message sent, agent selected, discussion started)
- `debug`: Detailed flow (WebSocket emits, heat updates)

**Log Format** (JSON):
```json
{
  "level": "info",
  "timestamp": "2026-03-30T14:00:00.000Z",
  "service": "agent-hub-backend",
  "traceId": "abc123",
  "event": "message.received",
  "data": {
    "roomId": "family-room-demo",
    "senderType": "human",
    "messageId": "msg_123",
    "source": "feishu"
  },
  "metadata": {
    "heat": 45,
    "agentSelected": "Mom",
    "processingTime": 1234
  }
}
```

### 1.5 Alerting Rules

**Sentry Alerts**:
- Any uncaught exception
- OpenClaw CLI timeout (> 120s)
- Database connection failures
- Feishu API errors (> 5 in 5min)

**Prometheus Alerts**:
- High error rate (> 5% of requests)
- High latency (p95 > 2s for 5min)
- Service down (health check failing)
- WebSocket disconnections (all clients disconnected)

### 1.6 Implementation Files

```
server/src/
├── middleware/
│   ├── metrics.middleware.ts      # Prometheus metrics collection
│   ├── logging.middleware.ts       # Winston request logging
│   └── health.middleware.ts        # Health check handlers
├── services/
│   ├── monitoring.service.ts       # Metrics aggregation
│   ├── health-check.service.ts     # Deep health checks
│   └── error-tracker.service.ts    # Sentry integration
├── utils/
│   └── logger.ts                   # Winston logger configuration
└── routes/
    └── health.ts                   # /health, /metrics endpoints
```

---

## 2. Rate Limiting & Security

### 2.1 Rate Limiting Architecture

**Library**: `express-rate-limit` + `rate-limit-redis` (or in-memory for single instance)

**Rate Limit Tiers**:

| Endpoint Tier | Limit | Window | Use Case |
|---------------|-------|--------|----------|
| **Auth** | 5 requests | 1 minute | Login, token refresh |
| **Message Send** | 30 requests | 1 minute | Normal user messaging |
| **Message Read** | 100 requests | 1 minute | Loading message history |
| **WebSocket** | 100 events | 1 minute | Socket.io events |
| **Admin** | 60 requests | 1 minute | Admin dashboard actions |
| **Health/Metrics** | No limit | - | Monitoring endpoints |

### 2.2 Rate Limit Implementation

#### Global Rate Limiter (Default)
```typescript
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Route-Specific Limiters
```typescript
// Message sending (stricter)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    return req.body.roomId || req.ip; // Per-room or per-IP
  }
});

// Auth endpoints (very strict)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts'
});
```

#### WebSocket Rate Limiting
```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

const wsLimiter = new RateLimiterMemory({
  points: 100, // 100 events
  duration: 60, // per 60 seconds
});

// In Socket.io handler
io.on('connection', (socket) => {
  socket.use(async (event, next) => {
    try {
      await wsLimiter.consume(socket.id);
      next();
    } catch (rej) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      next(new Error('Rate limit exceeded'));
    }
  });
});
```

### 2.3 Authentication & Authorization

#### JWT-Based Authentication (Optional for Admin)
```typescript
import jwt from 'jsonwebtoken';

// Token generation (admin login)
const token = jwt.sign(
  { userId: 'admin', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Middleware for protected routes
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### API Key Authentication (For External Services)
```typescript
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};
```

### 2.4 Data Encryption

#### Sensitive Data Encryption (Database)
```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(text: string): { encrypted: string, iv: string, tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return { encrypted, iv: iv.toString('hex'), tag };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### What to Encrypt
- User tokens (if stored)
- API keys
- Feishu access tokens
- Any PII (personally identifiable information)

#### What NOT to Encrypt
- Message content (needed for search/context)
- Agent names/avatars
- Room names
- Heat scores

### 2.5 Security Headers

**Library**: `helmet`

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Next.js needs this
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for some Next.js features
}));
```

### 2.6 Implementation Files

```
server/src/
├── middleware/
│   ├── rate-limit.middleware.ts    # Rate limiting configuration
│   ├── auth.middleware.ts          # JWT/API key authentication
│   └── security.middleware.ts      # Helmet security headers
├── services/
│   └── encryption.service.ts       # Data encryption/decryption
├── routes/
│   └── auth.ts                     # Admin authentication endpoints
└── config/
    └── rate-limits.ts              # Rate limit configurations
```

---

## 3. CI/CD Pipeline

### 3.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Push                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│               GitHub Actions Workflow                   │
├─────────────────────────────────────────────────────────┤
│  Stage 1: Lint & Type Check                             │
│  ├─ npm run lint                                        │
│  ├─ npm run type-check                                  │
│  └─ Fail on errors                                      │
├─────────────────────────────────────────────────────────┤
│  Stage 2: Unit Tests                                    │
│  ├─ npm run test:unit                                   │
│  └─ Fail if < 80% coverage                              │
├─────────────────────────────────────────────────────────┤
│  Stage 3: E2E Tests                                     │
│  ├─ Start backend (port 4000)                           │
│  ├─ Start frontend (port 3000)                          │
│  ├─ Run Playwright tests                                │
│  └─ Fail if any test fails                              │
├─────────────────────────────────────────────────────────┤
│  Stage 4: Build                                         │
│  ├─ Build backend (tsc)                                 │
│  ├─ Build frontend (next build)                         │
│  └─ Generate artifacts                                  │
├─────────────────────────────────────────────────────────┤
│  Stage 5: Deploy (main branch only)                     │
│  ├─ Deploy to staging                                   │
│  ├─ Run smoke tests                                     │
│  └─ Deploy to production (manual approval)              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      - name: Setup database
        run: npx prisma migrate deploy
      - name: Start backend
        run: npm run dev &
        env:
          DATABASE_URL: "file:./prisma/test.db"
      - name: Start frontend
        run: cd client && npm run dev &
      - name: Wait for services
        run: npx wait-on http://localhost:4000/health http://localhost:3000
      - name: Run E2E tests
        run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: e2e-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: dist/

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/
      - name: Deploy to staging
        run: |
          # Deploy commands (e.g., rsync, docker, kubectl)
          echo "Deploying to staging..."

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://agent-hub.example.com
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/
      - name: Deploy to production
        run: |
          # Deploy commands
          echo "Deploying to production..."
```

### 3.3 Database Migration Automation

**File**: `.github/workflows/db-migrate.yml`

```yaml
name: Database Migrations

on:
  push:
    paths:
      - 'prisma/schema.prisma'
      - 'prisma/migrations/**'

jobs:
  migrate-staging:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

  migrate-production:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://agent-hub.example.com
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

### 3.4 Docker Support (Optional)

**File**: `Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npm ci --only=production
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

**File**: `docker-compose.yml`

```yaml
version: '3.8'
services:
  agent-hub:
    build: .
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=file:/app/prisma/dev.db
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
    volumes:
      - ./prisma:/app/prisma
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-storage:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana-storage:
```

### 3.5 Implementation Files

```
.github/
├── workflows/
│   ├── ci.yml                    # Main CI/CD pipeline
│   └── db-migrate.yml            # Database migration workflow
Dockerfile                        # Container build instructions
docker-compose.yml                # Local development stack
monitoring/
├── prometheus.yml                # Prometheus configuration
└── grafana/
    └── dashboards/               # Grafana dashboard JSON exports
```

---

## 4. Implementation Plan

### Week 1: Monitoring & Alerting (8-10 hours)

**Day 1-2**: Winston Logging + Morgan HTTP Logging
- Set up Winston logger with JSON format
- Add request/response logging middleware
- Configure log levels and rotation
- **Deliverable**: Structured logs in `/logs` directory

**Day 3-4**: Prometheus Metrics
- Install `prom-client` library
- Create metrics middleware (request counting, timing)
- Add custom metrics (OpenClaw timing, agent selection)
- Expose `/metrics` endpoint
- **Deliverable**: Prometheus metrics endpoint working

**Day 5**: Health Checks + Sentry
- Implement `/health` and `/health/detailed` endpoints
- Integrate Sentry for error tracking
- Set up alerting rules
- **Deliverable**: Health checks + Sentry dashboard

### Week 2: Rate Limiting & Security (6-8 hours)

**Day 1-2**: Rate Limiting
- Install `express-rate-limit`
- Configure global and route-specific limiters
- Add WebSocket rate limiting
- Test rate limit behavior
- **Deliverable**: Rate limiting active on all endpoints

**Day 3**: Authentication
- Implement JWT authentication for admin routes
- Add API key middleware for external services
- Create auth endpoints (login, refresh)
- **Deliverable**: Protected admin routes

**Day 4**: Encryption + Security Headers
- Implement encryption service for sensitive data
- Add Helmet security headers
- Encrypt Feishu tokens in database
- **Deliverable**: Encrypted sensitive fields

**Day 5**: Testing + Documentation
- Write tests for rate limiting
- Test authentication flows
- Document security configuration
- **Deliverable**: Security documentation

### Week 3: CI/CD Pipeline (6-8 hours)

**Day 1-2**: GitHub Actions Workflow
- Create `.github/workflows/ci.yml`
- Set up lint, type-check, test stages
- Configure E2E test runners with Playwright
- **Deliverable**: CI pipeline running on PRs

**Day 3**: Build Artifacts + Deployment
- Add build stage to workflow
- Configure deployment to staging
- Set up production deployment with approval
- **Deliverable**: Automated deployments

**Day 4**: Database Migration Automation
- Create separate migration workflow
- Configure staging/production migration jobs
- Test migration rollback procedures
- **Deliverable**: Automated migrations

**Day 5**: Docker + Monitoring Stack
- Create Dockerfile for containerization
- Set up docker-compose with Prometheus/Grafana
- Configure monitoring dashboards
- **Deliverable**: One-command local deployment

---

## 5. Success Criteria

### Monitoring & Alerting ✅
- [ ] All HTTP requests logged with timing
- [ ] Prometheus metrics exposed at `/metrics`
- [ ] Health checks return accurate status
- [ ] Sentry captures all uncaught exceptions
- [ ] Alerts configured for critical failures

### Rate Limiting & Security ✅
- [ ] Rate limits active on all API endpoints
- [ ] WebSocket events rate-limited
- [ ] Admin routes protected by JWT
- [ ] Sensitive data encrypted in database
- [ ] Security headers configured (Helmet)

### CI/CD Pipeline ✅
- [ ] Lint/type-check runs on every PR
- [ ] Unit tests run with coverage reporting
- [ ] E2E tests run in headless mode
- [ ] Build artifacts generated
- [ ] Staging deployment automatic
- [ ] Production deployment with approval
- [ ] Database migrations automated

---

## 6. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Rate limiting blocks legitimate users | High | Medium | Start with generous limits, monitor and adjust |
| Encryption key loss | Critical | Low | Backup keys securely, use key management service |
| CI/CD pipeline failures block deploys | High | Medium | Keep manual deploy fallback, test pipeline regularly |
| Monitoring overhead slows app | Medium | Low | Use sampling for high-volume metrics, async logging |
| Sentry noise (too many alerts) | Medium | High | Configure alert thresholds, group similar errors |

---

## 7. Next Steps

1. **Review this design** with stakeholders
2. **Prioritize components** (Monitoring → Security → CI/CD)
3. **Set up accounts**:
   - Sentry.io (free tier: 5K errors/month)
   - Grafana Cloud (free tier: 10K series)
   - GitHub Actions (free: 2K minutes/month)
4. **Start implementation** with Week 1 (Monitoring)
5. **Test thoroughly** before deploying to production

---

**Ready to start?** I recommend beginning with **Monitoring & Alerting** (Week 1) as it provides immediate visibility into system health and will help debug issues during the rest of the implementation.

Which component would you like to tackle first? 🚀
