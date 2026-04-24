# Deployment Guide

**Last Updated:** 2026-04-07  
**Version:** 1.0

---

## Quick Start

### Local Development (Docker)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment (Kubernetes)

```bash
# Deploy to Kubernetes
helm install agent-hub ./k8s/helm/agent-hub \
  --namespace agent-hub-prod \
  --create-namespace \
  --values k8s/helm/agent-hub/values-prod.yaml

# Monitor deployment
kubectl get pods -n agent-hub-prod -w
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended for Local/Testing)

**Pros:**

- Simple setup
- All services in one command
- Easy to test locally

**Cons:**

- No auto-scaling
- Single point of failure
- Manual updates

**Setup:**

1. Copy `.env.example` to `.env`
2. Configure environment variables
3. Run `docker-compose up -d`

**Services:**

- Backend (Port 4000)
- Frontend (Port 3000)
- SQLite Database (volume mounted)

### Option 2: Kubernetes with Helm (Production)

**Pros:**

- Auto-scaling
- High availability
- Rolling updates
- Self-healing

**Cons:**

- More complex setup
- Requires K8s cluster
- Higher resource usage

**Requirements:**

- Kubernetes cluster (v1.20+)
- Helm (v3.0+)
- Storage class for PVC

**Setup:**

1. Configure `values-prod.yaml`
2. Create Kubernetes secrets
3. Deploy with Helm
4. Configure ingress and SSL

### Option 3: Local Development (Direct)

**For Development:**

```bash
# Backend
cd server && npm run dev

# Frontend
cd client && npm run dev
```

**Ports:**

- Backend: http://localhost:4000
- Frontend: http://localhost:3000

---

## Environment Configuration

### Required Variables

```bash
# Feishu Integration
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
FEISHU_VERIFY_TOKEN=xxx

# OpenClaw Integration
OPENCLAW_MODE=cli  # cli, http, or remote
OPENCLAW_VERIFICATION_TOKEN=xxx
OPENCLAW_GATEWAY_URL=http://localhost:18789  # For HTTP/Remote mode

# Security
JWT_SECRET=xxx  # Min 32 characters
ENCRYPTION_KEY=xxx  # 64 hex characters

# Database
DATABASE_URL=file:./prisma/dev.db
```

### Optional Variables

```bash
# API Authentication
API_KEY=xxx

# Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxx

# Remote Mode (SSH Tunnel)
SSH_HOST=xxx
SSH_USER=xxx
SSH_KEY_PATH=~/.ssh/id_rsa
```

---

## Docker Deployment

### Build Images

```bash
# Build backend
docker build -t agent-hub-backend:latest -f Dockerfile.backend .

# Build frontend
docker build -t agent-hub-frontend:latest -f Dockerfile.frontend .
```

### Run Containers

```bash
docker-compose up -d
```

### Health Checks

```bash
# Check backend health
curl http://localhost:4000/health

# Check frontend
curl http://localhost:3000
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Update Deployment

```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## Kubernetes Deployment

### Prerequisites

1. **Kubernetes Cluster**
   - Minikube, Kind, or cloud provider (EKS, GKE, AKS)
   - Minimum 2 nodes for HA

2. **Helm**

   ```bash
   helm version  # Should be v3.0+
   ```

3. **Storage Class**
   ```bash
   kubectl get storageclass
   ```

### Configuration

**values-prod.yaml:**

```yaml
replicaCount:
  backend: 3
  frontend: 2

resources:
  backend:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

ingress:
  enabled: true
  hosts:
    - agent-hub.example.com
  tls:
    - secretName: agent-hub-tls
      hosts:
        - agent-hub.example.com

persistence:
  enabled: true
  size: 10Gi
  storageClass: standard
```

### Deploy

```bash
# Create namespace
kubectl create namespace agent-hub-prod

# Create secrets
kubectl create secret generic agent-hub-secrets \
  --from-literal=FEISHU_APP_ID=xxx \
  --from-literal=FEISHU_APP_SECRET=xxx \
  --from-literal=JWT_SECRET=xxx \
  -n agent-hub-prod

# Deploy with Helm
helm install agent-hub ./k8s/helm/agent-hub \
  --namespace agent-hub-prod \
  --values k8s/helm/agent-hub/values-prod.yaml
```

### Monitor

```bash
# Check pods
kubectl get pods -n agent-hub-prod

# Check services
kubectl get svc -n agent-hub-prod

# View logs
kubectl logs -f deployment/agent-hub-backend -n agent-hub-prod

# Check events
kubectl get events -n agent-hub-prod --sort-by='.lastTimestamp'
```

### Scale

```bash
# Manual scaling
kubectl scale deployment agent-hub-backend --replicas=5 -n agent-hub-prod

# Auto-scaling (if HPA configured)
kubectl get hpa -n agent-hub-prod
```

### Update

```bash
# Rolling update
helm upgrade agent-hub ./k8s/helm/agent-hub \
  --namespace agent-hub-prod \
  --values k8s/helm/agent-hub/values-prod.yaml

# Rollback if needed
helm rollback agent-hub -n agent-hub-prod
```

---

## Remote Mode Setup (OpenClaw)

### SSH Tunnel Configuration

**For Remote OpenClaw Gateway:**

1. **Create SSH Tunnel**

   ```bash
   ssh -L 18789:localhost:18789 user@remote-host
   ```

2. **Configure Agent Hub**

   ```bash
   OPENCLAW_MODE=remote
   OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
   OPENCLAW_VERIFICATION_TOKEN=xxx
   ```

3. **Persistent Tunnel (systemd)**

   ```ini
   # /etc/systemd/system/openclaw-tunnel.service
   [Unit]
   Description=OpenClaw SSH Tunnel
   After=network.target

   [Service]
   ExecStart=/usr/bin/ssh -N -L 18789:localhost:18789 user@remote-host
   Restart=always
   User=agent-hub

   [Install]
   WantedBy=multi-user.target
   ```

### Tailscale Alternative

**For Tailscale Networks:**

```bash
# Enable Tailscale serve
tailscale serve https --terminate-proxy --proxy-to=http://localhost:4000 4000
```

---

## Monitoring & Alerting

### Health Endpoints

- `/health` - Basic health check
- `/health/detailed` - Detailed health with service status
- `/metrics` - Prometheus metrics

### Key Metrics

- HTTP request latency (p95 < 2s)
- OpenClaw CLI execution time (p95 < 60s)
- Agent response time (p95 < 30s)
- Database query time (p95 < 500ms)
- Error rate (< 5%)

### Alerts

**Critical:**

- Backend pod down (> 5 minutes)
- Error rate > 10% (5 minutes)
- Database connection lost

**Warning:**

- Response latency p95 > 3s
- Error rate > 5% (5 minutes)
- SSH tunnel disconnected (remote mode)

---

## Backup & Recovery

### Database Backup

```bash
# Manual backup
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d)

# Automated (cron)
0 2 * * * cp /app/prisma/dev.db /backups/dev.db.$(date +\%Y\%m\%d)
```

### Recovery

```bash
# Stop services
docker-compose down

# Restore database
cp prisma/dev.db.backup.20260407 prisma/dev.db

# Start services
docker-compose up -d
```

---

## Troubleshooting

### Common Issues

**1. Backend Won't Start**

```bash
# Check logs
docker-compose logs backend

# Common causes:
# - Database migration failed
# - Port already in use
# - Missing environment variables
```

**2. Frontend Returns 404**

```bash
# Check build
docker-compose logs frontend

# Verify NEXT_PUBLIC_API_URL is set correctly
# Check if backend is accessible from frontend container
```

**3. OpenClaw Connection Failed**

```bash
# Verify mode configuration
# Check gateway URL accessibility
# Verify authentication token
```

**4. Database Locked**

```bash
# Check for zombie processes
lsof | grep dev.db

# Remove lock file
rm prisma/dev.db-journal
```

### Get Help

- Documentation: `/docs` directory
- Logs: `docker-compose logs -f`
- Metrics: `http://localhost:4000/metrics`
- Issues: GitHub Issues

---

## Security Best Practices

### Container Security

- Run as non-root user
- Read-only root filesystem
- Drop unnecessary capabilities
- Use specific image tags (not `latest`)

### Network Security

- Network policies for pod isolation
- Ingress with TLS termination
- Rate limiting at ingress level

### Secrets Management

- Use Kubernetes secrets or Docker secrets
- Never commit secrets to git
- Rotate secrets regularly
- Use different secrets per environment

### Database Security

- Encrypt sensitive data at rest
- Use prepared statements (Prisma does this)
- Regular backups
- Limit database user permissions

---

## Performance Optimization

### Backend

- Enable connection pooling
- Use database indexes
- Cache frequently accessed data
- Optimize Prisma queries

### Frontend

- Enable Next.js production build
- Use CDN for static assets
- Enable gzip/brotli compression
- Implement lazy loading

### Database

- Regular VACUUM (SQLite)
- Monitor query performance
- Add indexes for frequent queries
- Archive old data

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Build and Push
        run: |
          docker build -t agent-hub-backend:latest -f Dockerfile.backend .
          docker push $REGISTRY/agent-hub-backend:latest

      - name: Deploy to K8s
        run: |
          helm upgrade agent-hub ./k8s/helm/agent-hub \
            --namespace agent-hub-prod \
            --values values-prod.yaml
```

### Pre-Commit Hooks

```bash
# Install husky
npm run prepare

# Hooks run automatically on git commit
- Lint check
- Type check
- Test execution
- Format check
```

---

## Migration Guide

### From Local to Production

1. **Update Environment Variables**
   - Change DATABASE_URL to production database
   - Update API endpoints
   - Configure production secrets

2. **Database Migration**

   ```bash
   npx prisma migrate deploy
   ```

3. **Deploy**

   ```bash
   helm install agent-hub ./k8s/helm/agent-hub \
     --namespace agent-hub-prod
   ```

4. **Verify**
   - Check health endpoints
   - Test all features
   - Monitor logs and metrics

### Rollback Plan

1. **Keep Previous Version**

   ```bash
   helm history agent-hub -n agent-hub-prod
   ```

2. **Rollback if Needed**

   ```bash
   helm rollback agent-hub 1 -n agent-hub-prod
   ```

3. **Database Rollback**
   - Restore from backup
   - Run rollback migrations

---

## Support

**Documentation:**

- Architecture: `ARCHITECTURE.md`
- Features: `docs/FEATURES.md`
- Milestones: `docs/MILESTONES.md`
- Troubleshooting: `TROUBLESHOOTING-GUIDE.md`

**Contact:**

- GitHub Issues
- Email: support@example.com
- Slack: #agent-hub

**Last Reviewed:** 2026-04-07  
**Next Review:** 2026-05-07
