# P0 Deployment Design

**Date**: 2026-04-01  
**Phase**: Phase 3 (Polish & Production)  
**Priority**: P0 (Critical)  
**Author**: Agent Hub Team

---

## Overview

This document defines where and how Agent Hub services will be deployed, covering infrastructure options, environment configurations, and deployment strategies.

---

## 1. Current State Analysis

### Current Setup (Development)

```
┌─────────────────────────────────────────────────────────┐
│              Local Machine (WSL2)                       │
├─────────────────────────────────────────────────────────┤
│  Backend (port 4000) - Express.js + tsx watch          │
│  Frontend (port 3000) - Next.js dev server             │
│  Database (SQLite) - /home/jlguo/agent-hub/prisma/dev.db│
│  OpenClaw CLI - Local installation                     │
│  Feishu SDK - WebSocket connection                     │
└─────────────────────────────────────────────────────────┘
```

**Issues with Current Setup**:
- ❌ Not accessible from internet (Feishu webhook needs public URL)
- ❌ No redundancy (single point of failure)
- ❌ Manual deployment (error-prone)
- ❌ No staging environment
- ❌ Database not backed up
- ❌ Tied to local machine (must keep laptop running 24/7)

---

## 2. Deployment Options

### Option A: VPS (Virtual Private Server) ⭐ RECOMMENDED

**Provider**: Vultr / DigitalOcean / Linode / AWS Lightsail  
**Location**: Singapore or Tokyo (closest to China for Feishu latency)  
**Spec**: 2 vCPU, 4GB RAM, 80GB SSD  
**Cost**: $12-24/month

```
┌─────────────────────────────────────────────────────────┐
│                    VPS (Ubuntu 22.04)                   │
├─────────────────────────────────────────────────────────┤
│  Docker Compose Stack:                                  │
│  ├─ agent-hub-backend (port 4000)                      │
│  ├─ agent-hub-frontend (port 3000)                     │
│  ├─ SQLite database (volume mounted)                   │
│  ├─ Nginx (reverse proxy, port 80/443)                 │
│  └─ PM2 or systemd (process management)                │
├─────────────────────────────────────────────────────────┤
│  External Services:                                     │
│  ├─ OpenClaw CLI (local or remote)                     │
│  ├─ Feishu API (HTTPS)                                 │
│  └─ Let's Encrypt (SSL certificates)                   │
└─────────────────────────────────────────────────────────┘
```

**Pros**:
- ✅ Full control over environment
- ✅ Cost-effective ($12-24/month)
- ✅ Easy to set up and manage
- ✅ Good performance for single-digit thousands of users
- ✅ Singapore/Tokyo locations = low latency to Feishu (~30-50ms)

**Cons**:
- ❌ Manual scaling (need to upgrade VPS for more capacity)
- ❌ Single point of failure (unless multi-region setup)
- ❌ You manage OS updates, security patches

**Best For**: MVP, small-medium scale (family chats, small teams)

---

### Option B: PaaS (Platform as a Service)

**Provider**: Railway / Render / Fly.io / Vercel + Backend Service  
**Cost**: $20-50/month (free tiers available)

```
┌─────────────────────────────────────────────────────────┐
│                    Railway/Render                       │
├─────────────────────────────────────────────────────────┤
│  Frontend (Vercel)                                     │
│  ├─ Next.js static build                               │
│  ├─ CDN distribution                                    │
│  └─ Automatic HTTPS                                     │
├─────────────────────────────────────────────────────────┤
│  Backend (Railway)                                     │
│  ├─ Express.js container                                │
│  ├─ Auto-scaling                                        │
│  └─ Built-in monitoring                                 │
├─────────────────────────────────────────────────────────┤
│  Database (Railway PostgreSQL)                         │
│  ├─ Managed PostgreSQL                                  │
│  ├─ Automatic backups                                   │
│  └─ Connection pooling                                  │
└─────────────────────────────────────────────────────────┘
```

**Pros**:
- ✅ Zero DevOps (no server management)
- ✅ Auto-scaling
- ✅ Built-in monitoring and logging
- ✅ Automatic HTTPS
- ✅ Easy CI/CD integration

**Cons**:
- ❌ More expensive ($20-50/month)
- ❌ Less control over infrastructure
- ❌ Vendor lock-in
- ❌ Cold starts on free tiers
- ❌ OpenClaw CLI compatibility issues (need custom Docker image)

**Best For**: Teams without DevOps expertise, rapid iteration

---

### Option C: Hybrid (VPS + Managed Services) ⭐ RECOMMENDED FOR PRODUCTION

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│                    VPS (Ubuntu 22.04)                   │
├─────────────────────────────────────────────────────────┤
│  Docker Compose:                                        │
│  ├─ agent-hub-backend (Express.js)                     │
│  ├─ agent-hub-frontend (Next.js)                       │
│  ├─ Nginx (reverse proxy + SSL)                        │
│  └─ SQLite or PostgreSQL (volume mounted)              │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────────────────────────┐
│              Managed Services                           │
├─────────────────────────────────────────────────────────┤
│  Cloudflare (Free Tier)                                │
│  ├─ CDN for static assets                              │
│  ├─ DDoS protection                                     │
│  └─ SSL/TLS termination                                 │
├─────────────────────────────────────────────────────────┤
│  Sentry (Free Tier: 5K errors/month)                   │
│  └─ Error tracking and alerting                        │
├─────────────────────────────────────────────────────────┤
│  UptimeRobot (Free Tier)                               │
│  └─ Uptime monitoring (5min checks)                    │
└─────────────────────────────────────────────────────────┘
```

**Pros**:
- ✅ Best of both worlds (control + managed services)
- ✅ Cost-effective ($12-24/month VPS + free tiers)
- ✅ Production-grade reliability
- ✅ Good performance
- ✅ Easy to scale (upgrade VPS or add managed DB)

**Cons**:
- ❌ Slightly more complex setup
- ❌ Multiple service accounts to manage

**Best For**: Production deployments, growing user base

---

## 3. Recommended Architecture (Hybrid)

### Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Devices                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Feishu    │  │   Web UI    │  │   Mobile    │    │
│  │   App       │  │   (Browser) │  │   (Future)  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
         │                   │
         │ WebSocket         │ HTTPS
         │                   │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   Cloudflare CDN  │  ← DDoS protection, SSL termination
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │   Nginx (VPS)     │  ← Reverse proxy, rate limiting
         │   - SSL (Let's Encrypt)
         │   - Gzip compression
         │   - Static file caching
         └─────────┬─────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
┌───▼───────┐           ┌────────▼────────┐
│ Frontend  │           │    Backend      │
│ Next.js   │           │   Express.js    │
│ :3000     │           │   :4000         │
└───────────┘           └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼──────┐         ┌────────▼────────┐
              │  SQLite    │         │   OpenClaw      │
              │  Database  │         │   CLI (local)   │
              │  (volume)  │         │   or remote     │
              └────────────┘         └─────────────────┘
```

### Server Specifications

**Minimum** (Family chat, <10 users):
- CPU: 1 vCPU
- RAM: 2GB
- Storage: 40GB SSD
- Cost: ~$6-12/month

**Recommended** (Small team, 10-50 users):
- CPU: 2 vCPU
- RAM: 4GB
- Storage: 80GB SSD
- Cost: ~$12-24/month

**Production** (50-200 users):
- CPU: 4 vCPU
- RAM: 8GB
- Storage: 160GB SSD
- Cost: ~$24-48/month

### VPS Provider Comparison

| Provider | Plan | CPU | RAM | Storage | Price/mo | Location |
|----------|------|-----|-----|---------|----------|----------|
| **Vultr** | High Frequency | 2 | 4GB | 80GB | $12 | Singapore, Tokyo |
| **DigitalOcean** | Basic | 2 | 4GB | 80GB | $24 | Singapore |
| **Linode** | Dedicated | 2 | 4GB | 80GB | $20 | Tokyo, Singapore |
| **AWS Lightsail** | Standard | 2 | 4GB | 80GB | $10 | Tokyo, Singapore |
| **Hetzner** | Cloud | 2 | 4GB | 80GB | €5 | Finland, Germany |

**Recommendation**: **Vultr High Frequency** (best price/performance, Singapore location for Feishu)

---

## 4. Environment Configuration

### Environment Variables (.env)

```bash
# Server Configuration
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://agent-hub.yourdomain.com
BACKEND_URL=https://api.agent-hub.yourdomain.com

# Database
DATABASE_URL=file:/app/prisma/prod.db

# Feishu Integration
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
FEISHU_VERIFY_TOKEN=xxx

# OpenClaw
OPENCLAW_VERIFICATION_TOKEN=xxx
OPENCLAW_CLI_PATH=/usr/local/bin/openclaw

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
API_KEY=your-api-key-for-external-services

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=1000
```

### Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: agent-hub-backend
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - DATABASE_URL=file:/app/prisma/prod.db
    env_file:
      - .env.production
    volumes:
      - ./prisma:/app/prisma
      - ./logs:/app/logs
    networks:
      - agent-hub-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend (Next.js)
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
      target: production
    container_name: agent-hub-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.agent-hub.yourdomain.com
      - NEXT_PUBLIC_WS_URL=wss://agent-hub.yourdomain.com
    depends_on:
      - backend
    networks:
      - agent-hub-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: agent-hub-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - agent-hub-network

networks:
  agent-hub-network:
    driver: bridge

volumes:
  prisma-data:
  logs:
```

### Nginx Configuration

**File**: `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    # Upstream definitions
    upstream backend {
        server backend:4000;
        keepalive 64;
    }

    upstream frontend {
        server frontend:3000;
        keepalive 64;
    }

    # Rate limiting zone
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=100r/s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name agent-hub.yourdomain.com api.agent-hub.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # Main domain (Frontend)
    server {
        listen 443 ssl http2;
        server_name agent-hub.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket for Socket.io
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }

    # API subdomain (Backend)
    server {
        listen 443 ssl http2;
        server_name api.agent-hub.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s; # For OpenClaw CLI timeouts
        }

        # Health checks (no rate limiting)
        location /health {
            limit_req off;
            proxy_pass http://backend/health;
        }

        # Metrics endpoint (restrict to monitoring IPs)
        location /metrics {
            allow 10.0.0.0/8; # Internal monitoring
            deny all;
            proxy_pass http://backend/metrics;
        }
    }
}
```

---

## 5. Deployment Strategies

### Strategy 1: Manual Deployment (Simple)

**Steps**:
1. SSH into VPS
2. Pull latest code from Git
3. Run `docker-compose pull`
4. Run `docker-compose up -d`
5. Run database migrations: `docker-compose exec backend npx prisma migrate deploy`

**Script**: `deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin main

# Pull latest Docker images
docker-compose pull

# Stop old containers
docker-compose down

# Start new containers
docker-compose up -d

# Run database migrations
docker-compose exec -T backend npx prisma migrate deploy

# Check health
sleep 10
curl -f http://localhost:4000/health || exit 1

echo "✅ Deployment complete!"
```

**Pros**: Simple, full control  
**Cons**: Manual, error-prone, downtime during deploy

---

### Strategy 2: Zero-Downtime Deployment (Blue-Green)

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Load Balancer)                │
├─────────────────────────────────────────────────────────┤
│  Active: Blue (port 4001) ← Current production         │
│  Standby: Green (port 4002) ← New version              │
└─────────────────────────────────────────────────────────┘
```

**Steps**:
1. Deploy new version to Green (port 4002)
2. Run health checks on Green
3. Switch Nginx to route to Green
4. Monitor for errors
5. If OK, keep Green; if not, switch back to Blue
6. Clean up old Blue deployment

**Docker Compose** (blue-green setup):

```yaml
version: '3.8'

services:
  backend-blue:
    build: .
    container_name: agent-hub-backend-blue
    ports:
      - "4001:4000"
    environment:
      - PORT=4000
    networks:
      - agent-hub-network
    profiles:
      - blue

  backend-green:
    build: .
    container_name: agent-hub-backend-green
    ports:
      - "4002:4000"
    environment:
      - PORT=4000
    networks:
      - agent-hub-network
    profiles:
      - green

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx-blue.conf:/etc/nginx/nginx.conf:ro  # Switch config
    # or
      - ./nginx/nginx-green.conf:/etc/nginx/nginx.conf:ro
```

**Deployment Script**: `deploy-blue-green.sh`

```bash
#!/bin/bash
set -e

CURRENT_COLOR=$(cat .current-color 2>/dev/null || echo "blue")
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")
NEW_PORT=$([ "$NEW_COLOR" = "blue" ] && echo "4001" || echo "4002")

echo "🚀 Deploying to $NEW_COLOR environment..."

# Build and start new version
docker-compose --profile $NEW_COLOR up -d backend-$NEW_COLOR

# Wait for health check
echo "⏳ Waiting for health check..."
for i in {1..30}; do
  if curl -f http://localhost:$NEW_PORT/health 2>/dev/null; then
    echo "✅ Health check passed!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Health check failed after 30 attempts"
    exit 1
  fi
  sleep 2
done

# Switch Nginx to new version
echo "🔄 Switching traffic to $NEW_COLOR..."
cp nginx/nginx-$NEW_COLOR.conf nginx/nginx.conf
docker-compose restart nginx

# Update current color
echo "$NEW_COLOR" > .current-color

# Stop old version
echo "🧹 Cleaning up old $CURRENT_COLOR deployment..."
docker-compose --profile $CURRENT_COLOR stop backend-$CURRENT_COLOR

echo "✅ Deployment to $NEW_COLOR complete!"
```

**Pros**: Zero downtime, easy rollback  
**Cons**: More complex, requires 2x resources during deploy

---

### Strategy 3: CI/CD Automated Deployment (GitHub Actions)

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/jlguo/agent-hub
            git pull origin main
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T backend npx prisma migrate deploy
            sleep 10
            curl -f http://localhost:4000/health || exit 1
      
      - name: Notify Success
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"✅ Agent Hub deployed successfully!"}'
      
      - name: Notify Failure
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"❌ Agent Hub deployment failed!"}'
```

**Pros**: Fully automated, consistent, audit trail  
**Cons**: Requires CI/CD setup, SSH key management

---

## 6. Database Backup Strategy

### Automated Backups

**Script**: `backup-db.sh`

```bash
#!/bin/bash

BACKUP_DIR="/backups/agent-hub"
DATE=$(date +%Y%m%d_%H%M%S)
DB_FILE="/app/prisma/prod.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Copy database file
cp $DB_FILE $BACKUP_DIR/prod.db.$DATE

# Compress backup
gzip $BACKUP_DIR/prod.db.$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "prod.db.*.gz" -mtime +7 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/prod.db.$DATE.gz s3://your-bucket/backups/

echo "✅ Backup complete: $BACKUP_DIR/prod.db.$DATE.gz"
```

**Cron Job** (daily at 3 AM):

```bash
# crontab -e
0 3 * * * /home/jlguo/agent-hub/backup-db.sh >> /var/log/agent-hub-backup.log 2>&1
```

### Backup Locations

| Location | Retention | Cost | Recovery Time |
|----------|-----------|------|---------------|
| Local VPS | 7 days | Free | < 1 min |
| Cloud Storage (S3) | 30 days | ~$1/month | < 5 min |
| Remote Server | 30 days | ~$5/month | < 10 min |

**Recommendation**: Local + S3 (redundancy)

---

## 7. Monitoring & Alerting Setup

### Uptime Monitoring

**Service**: UptimeRobot (Free: 50 monitors, 5min checks)

**Configuration**:
- Monitor Type: HTTP(s)
- URL: `https://api.agent-hub.yourdomain.com/health`
- Check Interval: 5 minutes
- Alert Contacts: Email, SMS, Slack

**Alert Rules**:
- Service down → Immediate SMS + Email
- High latency (>2s) → Email
- SSL certificate expiring (<30 days) → Email

### Error Tracking

**Service**: Sentry (Free: 5K errors/month)

**Setup**:
1. Create Sentry project
2. Install `@sentry/node` in backend
3. Configure DSN in `.env`
4. Set up alert rules

**Alert Rules**:
- New error type → Slack notification
- Error rate > 5% → Email + Slack
- Critical errors → SMS

### Log Aggregation

**Option A**: Self-hosted (ELK Stack)
- Elasticsearch + Logstash + Kibana
- Cost: Free (but resource-intensive)
- Setup: Complex

**Option B**: Managed (Logtail / Papertrail)
- Cost: $7-20/month
- Setup: Easy
- **Recommendation**: Logtail (cheap, easy)

---

## 8. Security Considerations

### Firewall Configuration (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block all other incoming
sudo ufw default deny incoming
sudo ufw enable

# Check status
sudo ufw status
```

### SSH Hardening

**File**: `/etc/ssh/sshd_config`

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication
PasswordAuthentication no

# Use SSH keys only
PubkeyAuthentication yes

# Change SSH port (optional)
Port 2222

# Limit users
AllowUsers jlguo

# Restart SSH
sudo systemctl restart sshd
```

### SSL/TLS Configuration

**Certificate**: Let's Encrypt (Free, auto-renewal)

**Setup**:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d agent-hub.yourdomain.com -d api.agent-hub.yourdomain.com

# Auto-renewal (already configured by Certbot)
sudo certbot renew --dry-run
```

---

## 9. Cost Breakdown

### Monthly Costs (Recommended Setup)

| Service | Tier | Cost/Month | Annual Cost |
|---------|------|------------|-------------|
| **VPS (Vultr)** | 2 vCPU, 4GB | $12 | $144 |
| **Domain** | Namecheap | $1 | $12 |
| **Cloudflare** | Free | $0 | $0 |
| **Sentry** | Free (5K errors) | $0 | $0 |
| **UptimeRobot** | Free (50 monitors) | $0 | $0 |
| **Logtail** | Free (500MB/day) | $0 | $0 |
| **S3 Backups** | 5GB | $0.12 | $1.44 |
| **Total** | | **$13.12** | **$157.44** |

### Cost Optimization Tips

1. **Use free tiers**: Sentry, UptimeRobot, Logtail all have generous free tiers
2. **Annual billing**: Some providers offer 10-20% discount for annual payment
3. **Start small**: Begin with 1 vCPU VPS ($6/month), upgrade as needed
4. **Spot instances**: AWS spot instances can save 70% (but can be terminated)

---

## 10. Implementation Checklist

### Pre-Deployment
- [ ] Purchase domain name
- [ ] Set up VPS account (Vultr/DigitalOcean)
- [ ] Configure DNS records (A record → VPS IP)
- [ ] Set up Cloudflare (optional but recommended)
- [ ] Generate SSH keys
- [ ] Configure VPS firewall (UFW)
- [ ] Harden SSH configuration

### Deployment
- [ ] Install Docker + Docker Compose on VPS
- [ ] Clone repository to VPS
- [ ] Configure environment variables (.env.production)
- [ ] Set up Nginx configuration
- [ ] Obtain SSL certificate (Let's Encrypt)
- [ ] Run initial deployment
- [ ] Run database migrations
- [ ] Verify health checks

### Post-Deployment
- [ ] Set up monitoring (Sentry, UptimeRobot)
- [ ] Configure log aggregation
- [ ] Set up automated backups
- [ ] Test disaster recovery (restore from backup)
- [ ] Document deployment process
- [ ] Set up CI/CD pipeline (optional)

### Ongoing Maintenance
- [ ] Weekly: Check logs for errors
- [ ] Monthly: Review resource usage, optimize if needed
- [ ] Quarterly: Update dependencies, security patches
- [ ] As needed: Scale VPS based on usage

---

## 11. Disaster Recovery Plan

### Scenario 1: VPS Crashes

**Recovery Steps**:
1. Spin up new VPS (same provider or different)
2. Restore from S3 backup
3. Update DNS to new IP
4. Verify services

**Recovery Time**: 30-60 minutes  
**Data Loss**: Last backup (max 24 hours)

### Scenario 2: Database Corruption

**Recovery Steps**:
1. Stop application containers
2. Restore from local backup (7 days) or S3 (30 days)
3. Run integrity check
4. Restart application

**Recovery Time**: 10-20 minutes  
**Data Loss**: Since last backup

### Scenario 3: Security Breach

**Recovery Steps**:
1. Isolate VPS (disconnect from network)
2. Analyze logs for breach vector
3. Patch vulnerability
4. Rebuild VPS from scratch
5. Restore from clean backup
6. Rotate all credentials (SSH keys, API keys, JWT secrets)

**Recovery Time**: 2-4 hours  
**Data Loss**: Depends on backup age

---

## 12. Scaling Strategy

### Vertical Scaling (Scale Up)

**When**: CPU/RAM consistently > 80%  
**How**: Upgrade VPS plan (1-click in most providers)  
**Downtime**: 5-10 minutes  
**Cost**: Increases linearly

**Upgrade Path**:
```
Current: 2 vCPU, 4GB RAM ($12/mo)
  ↓ (when needed)
Next: 4 vCPU, 8GB RAM ($24/mo)
  ↓ (when needed)
Large: 8 vCPU, 16GB RAM ($48/mo)
```

### Horizontal Scaling (Scale Out)

**When**: Single VPS can't handle load  
**How**: Add load balancer + multiple VPS instances  
**Downtime**: Zero (with proper setup)  
**Cost**: Increases linearly

**Architecture**:
```
         ┌─────────────┐
         │ Load Balancer│
         │ (Cloudflare) │
         └──────┬──────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│ VPS 1 │  │ VPS 2 │  │ VPS 3 │
└───┬───┘  └───┬───┘  └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │
         ┌──────▼──────┐
         │ Shared DB   │
         │ (PostgreSQL)│
         └─────────────┘
```

**When to Scale**:
- **100 concurrent users**: Single VPS (4 vCPU, 8GB)
- **500 concurrent users**: 2-3 VPS + Load Balancer
- **1000+ concurrent users**: Consider managed services (Railway, Render)

---

## 13. Recommendations Summary

### For MVP / Family Chat (Current Stage)

**Setup**: Single VPS (Vultr, 2 vCPU, 4GB)  
**Cost**: $12/month  
**Deployment**: Manual with deploy.sh script  
**Monitoring**: UptimeRobot (free) + Sentry (free)  
**Backups**: Local + S3 (daily)

**Why**: Simple, cost-effective, easy to manage

### For Production / Small Team (10-50 users)

**Setup**: Single VPS (Vultr, 4 vCPU, 8GB) + Cloudflare  
**Cost**: $24/month  
**Deployment**: CI/CD with GitHub Actions  
**Monitoring**: Sentry + Logtail + UptimeRobot  
**Backups**: Local + S3 + Remote server

**Why**: Better performance, automated deployment, redundant backups

### For Scale (50-200 users)

**Setup**: 2-3 VPS + Load Balancer + Managed PostgreSQL  
**Cost**: $50-100/month  
**Deployment**: Blue-green with zero downtime  
**Monitoring**: Full ELK stack or managed logging  
**Backups**: Multi-region

**Why**: High availability, horizontal scaling, managed database

---

## 14. Next Steps

1. **Choose VPS provider** (recommendation: Vultr High Frequency, Singapore)
2. **Purchase domain** (if not already done)
3. **Set up DNS** (point to VPS IP)
4. **Configure VPS** (Docker, Nginx, SSL)
5. **Deploy application** (manual or CI/CD)
6. **Set up monitoring** (Sentry, UptimeRobot)
7. **Configure backups** (daily automated)
8. **Test disaster recovery** (restore from backup)

---

**Ready to deploy?** I recommend starting with the **MVP setup** (single VPS, $12/month) and upgrading as needed. This gives you production-grade infrastructure without over-engineering.

Would you like me to:
- **A)** Create the deployment scripts (deploy.sh, backup-db.sh)?
- **B)** Set up the Docker configuration (Dockerfile, docker-compose.yml)?
- **C)** Configure the VPS (step-by-step guide)?
- **D)** Set up CI/CD pipeline (GitHub Actions)?

What's your priority? 🚀
