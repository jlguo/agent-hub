# Phase 2: Production Deployment Guide

**Status**: 🔄 IN PROGRESS  
**Priority**: Must-Have  
**Started**: 2026-04-03  
**Target**: 2026-04-10 (1 week)

---

## Overview

This guide covers the complete production deployment infrastructure for Agent Hub using Docker and Kubernetes.

**Deployment Strategy**: Hybrid approach

- ✅ Local development: Docker Desktop + Kubernetes
- ✅ Staging: Docker Compose or K8s namespace
- ✅ Production: Managed Kubernetes (recommended)

---

## Quick Start

### Option 1: Docker Compose (Simplest)

```bash
# Build images
npm run docker:build

# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Option 2: Local Kubernetes (Docker Desktop)

```bash
# Enable Kubernetes in Docker Desktop
# Then deploy with Helm:
npm run k8s:dev

# Access services:
kubectl port-forward svc/backend -n agent-hub-dev 4000:4000
kubectl port-forward svc/frontend -n agent-hub-dev 3000:3000
```

### Option 3: Manual Docker Build

```bash
# Build backend
docker build -t agent-hub-backend:latest -f Dockerfile.backend .

# Build frontend
docker build -t agent-hub-frontend:latest -f Dockerfile.frontend .

# Run backend
docker run -d -p 4000:4000 \
  --env-file .env \
  -v agent-hub-data:/app/prisma \
  agent-hub-backend:latest

# Run frontend
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:4000 \
  agent-hub-frontend:latest
```

---

## Docker Files Created

### 1. Dockerfile.backend

**Purpose**: Containerize Express.js backend  
**Base Image**: Node 20 Alpine  
**Size**: ~200MB (optimized multi-stage build)

**Features**:

- ✅ Multi-stage build (smaller production image)
- ✅ Non-root user (security)
- ✅ Health check endpoint
- ✅ Production dependencies only
- ✅ Volume mount for SQLite persistence

**Optimization**:

```dockerfile
# Production image only includes:
- node_modules (production only)
- server/ (compiled code)
- prisma/ (database schema)
```

### 2. Dockerfile.frontend

**Purpose**: Containerize Next.js frontend  
**Base Image**: Node 20 Alpine  
**Size**: ~300MB (includes Next.js build)

**Features**:

- ✅ Multi-stage build
- ✅ Non-root user
- ✅ Health check
- ✅ Production build optimized
- ✅ Static asset serving

### 3. docker-compose.yml

**Purpose**: Local development and staging deployment

**Services**:

- **backend**: Express API (port 4000)
- **frontend**: Next.js UI (port 3000)
- **volumes**: Persistent SQLite database

**Configuration**:

```yaml
backend:
  ports: ['4000:4000']
  volumes: ['backend-data:/app/prisma']
  healthcheck: /health endpoint
  restart: unless-stopped

frontend:
  ports: ['3000:3000']
  depends_on: [backend]
  healthcheck: root endpoint
  restart: unless-stopped
```

---

## Kubernetes Deployment

### Existing Helm Chart

Location: `k8s/helm/agent-hub/`

**Components**:

- Namespace with Pod Security Standards
- ConfigMap (environment variables)
- Secrets (sensitive data)
- Backend Deployment (3 replicas)
- Frontend Deployment (2 replicas)
- Services (ClusterIP)
- Ingress (Nginx + SSL)
- PersistentVolumeClaim (10GB)
- HorizontalPodAutoscaler (1-10 replicas)
- NetworkPolicy (security)
- ServiceMonitor (Prometheus)
- PrometheusRules (alerting)

### Deploy to Local K8s

```bash
# 1. Enable Kubernetes in Docker Desktop
# 2. Install Helm (if not installed)
brew install helm  # macOS
# or download from https://helm.sh

# 3. Deploy to dev namespace
npm run k8s:dev

# 4. Check status
kubectl get pods -n agent-hub-dev
kubectl get svc -n agent-hub-dev

# 5. Access services
kubectl port-forward svc/backend -n agent-hub-dev 4000:4000
kubectl port-forward svc/frontend -n agent-hub-dev 3000:3000
```

### Deploy to Production K8s

```bash
# 1. Create production values file
cp k8s/helm/agent-hub/values.yaml k8s/helm/agent-hub/values-prod.yaml

# 2. Edit values-prod.yaml:
#    - Set replica counts higher
#    - Configure resource limits
#    - Set production domain
#    - Enable SSL

# 3. Deploy
npm run k8s:prod

# 4. Monitor deployment
kubectl rollout status deployment/backend -n agent-hub-prod
kubectl rollout status deployment/frontend -n agent-hub-prod
```

---

## Environment Variables

### Required Variables

Create `.env` file for Docker:

```bash
# Feishu Integration
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
FEISHU_VERIFY_TOKEN=xxx

# OpenClaw
OPENCLAW_VERIFICATION_TOKEN=xxx

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=64-hex-characters-for-aes-256-gcm

# Optional
API_KEY=internal-api-key
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Generate Secure Keys

```bash
# JWT Secret (min 32 chars)
openssl rand -base64 32

# Encryption Key (64 hex chars for AES-256-GCM)
openssl rand -hex 32
```

---

## Database Persistence

### SQLite (Default)

**Volume Mount**:

```yaml
volumes:
  - backend-data:/app/prisma
```

**Location**: `/app/prisma/dev.db` inside container

**Backup**:

```bash
# Copy database file
docker cp $(docker ps -q -f name=backend):/app/prisma/dev.db ./backup.db
```

### PostgreSQL (Future)

For multi-node deployments, switch to managed PostgreSQL:

```yaml
# In values.yaml
database:
  type: postgresql
  host: postgres-service
  port: 5432
  name: agent_hub
  user: agent_hub_user
  passwordSecret: postgres-password
```

---

## Health Checks

### Backend

**Endpoint**: `http://localhost:4000/health`

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2026-04-03T01:00:00.000Z",
  "uptime": 3600
}
```

**Docker Healthcheck**:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s \
  CMD wget --spider http://localhost:4000/health
```

### Frontend

**Endpoint**: `http://localhost:3000`

**Check**: Root page loads successfully

**Docker Healthcheck**:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s \
  CMD wget --spider http://localhost:3000
```

---

## Scaling

### Horizontal Scaling (Kubernetes)

**Backend**: 1-10 replicas (auto-scaled by CPU/memory)

```yaml
# HPA configuration
minReplicas: 1
maxReplicas: 10
targetCPUUtilization: 80%
targetMemoryUtilization: 80%
```

**Frontend**: 2-5 replicas (stateless, easy to scale)

### Vertical Scaling

Increase container resources in `values.yaml`:

```yaml
backend:
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi
```

---

## Monitoring

### Built-in Monitoring

- ✅ Health endpoints (`/health`, `/metrics`)
- ✅ Prometheus ServiceMonitors
- ✅ 6 alerting rules configured
- ✅ Grafana dashboard templates (future)

### External Monitoring

**Sentry**: Error tracking (configure SENTRY_DSN)

**Uptime Monitoring**:

- UptimeRobot (free tier)
- Pingdom
- StatusCake

---

## Backup & Recovery

### Database Backup

**Automated Daily Backup** (future enhancement):

```bash
# Cron job to backup SQLite
0 2 * * * docker cp $(docker ps -q -f name=backend):/app/prisma/dev.db /backups/agent-hub-$(date +\%Y\%m\%d).db
```

### Disaster Recovery

1. **Restore Database**:

```bash
docker cp backup.db $(docker ps -q -f name=backend):/app/prisma/dev.db
```

2. **Redeploy**:

```bash
npm run docker:down
npm run docker:up
```

---

## Security

### Container Security

- ✅ Non-root user (UID 1001)
- ✅ Read-only filesystem (where possible)
- ✅ Dropped capabilities
- ✅ No privileged mode
- ✅ Health checks for self-healing

### Network Security

- ✅ NetworkPolicy (K8s)
- ✅ Internal service communication only
- ✅ Ingress with SSL termination
- ✅ No direct pod-to-pod communication

### Secrets Management

- ✅ Kubernetes Secrets (not in git)
- ✅ .env file for Docker (not committed)
- ✅ AES-256-GCM encryption for sensitive data
- ✅ JWT authentication for admin routes

---

## Troubleshooting

### Common Issues

**1. Container won't start**:

```bash
# Check logs
docker logs <container-id>

# Check health
curl http://localhost:4000/health
```

**2. Database not persisting**:

```bash
# Verify volume mount
docker volume inspect agent-hub_backend-data

# Check file exists
docker exec <backend-container> ls -la /app/prisma/
```

**3. Port conflicts**:

```bash
# Find process using port
lsof -ti:4000

# Kill process
kill -9 $(lsof -ti:4000)
```

**4. Kubernetes deployment failing**:

```bash
# Check pod status
kubectl get pods -n agent-hub-dev

# Check logs
kubectl logs deployment/backend -n agent-hub-dev

# Describe pod for events
kubectl describe pod <pod-name> -n agent-hub-dev
```

---

## Next Steps

### Phase 2 Remaining Tasks

- [ ] Test Docker Compose deployment locally
- [ ] Test Helm chart on Docker Desktop K8s
- [ ] Configure SSL/TLS for production
- [ ] Set up staging environment
- [ ] Document production deployment checklist
- [ ] Backup automation script
- [ ] Load testing (verify scaling works)

### Parallel Milestone 4 Tasks

- Continue writing unit tests (target: 40%+ coverage)
- Add integration tests
- Maintain 85%+ test pass rate

---

## Success Criteria

Phase 2 is complete when:

- ✅ Docker images build successfully
- ✅ Docker Compose starts all services
- ✅ Helm chart deploys to local K8s
- ✅ Health checks pass
- ✅ Database persists across restarts
- ✅ Staging environment accessible
- ✅ Production deployment documented
- ✅ Backup/recovery tested

---

**Last Updated**: 2026-04-03  
**Author**: Agent Hub Team  
**Status**: 🔄 IN PROGRESS
