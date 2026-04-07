# Configuration Guide

**Last Updated:** 2026-04-07  
**Version:** 1.0

---

## Quick Start

### Minimum Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env

# Start the application
./start.sh
```

---

## Environment Variables

### Feishu Integration (Required for Feishu Support)

| Variable              | Type   | Required | Description                | Example                               |
| --------------------- | ------ | -------- | -------------------------- | ------------------------------------- |
| `FEISHU_APP_ID`       | String | Yes      | Feishu application ID      | `cli_a930b22377b9dcd6`                |
| `FEISHU_APP_SECRET`   | String | Yes      | Feishu app secret          | `CbnapLyCprizpwj0DC4RZkpSGb1HFiMR`    |
| `FEISHU_CHAT_ID`      | String | Yes      | Target chat room ID        | `oc_ca9b129b5264ac7b79a569d0dd0b1022` |
| `FEISHU_VERIFY_TOKEN` | String | Yes      | Webhook verification token | `agent-hub-verify-token`              |

**How to Get:**

1. Go to [Feishu Open Platform](https://open.feishu.cn/)
2. Create a new application
3. Get App ID and Secret from Credentials
4. Set Verify Token in Event Subscriptions
5. Add bot to your Feishu group chat

### OpenClaw Integration (Required for Agent Responses)

| Variable                      | Type   | Required    | Description                               | Example                                            |
| ----------------------------- | ------ | ----------- | ----------------------------------------- | -------------------------------------------------- |
| `OPENCLAW_MODE`               | String | Yes         | OpenClaw mode: `cli`, `http`, or `remote` | `cli`                                              |
| `OPENCLAW_VERIFICATION_TOKEN` | String | Conditional | Required for HTTP/Remote mode             | `4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468` |
| `OPENCLAW_GATEWAY_URL`        | String | Conditional | Required for HTTP/Remote mode             | `http://localhost:18789` or `ws://127.0.0.1:18789` |

**Mode Selection:**

- **CLI** (Recommended): Uses local OpenClaw CLI installation
- **HTTP**: Uses OpenClaw Gateway HTTP API
- **Remote**: Uses SSH tunnel to remote OpenClaw Gateway

### Security (Required for Production)

| Variable         | Type   | Required | Description                               | Example                                                            |
| ---------------- | ------ | -------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `JWT_SECRET`     | String | Yes      | JWT signing secret (min 32 chars)         | `super-secret-jwt-key-min-32-chars-long`                           |
| `ENCRYPTION_KEY` | String | Yes      | AES-256-GCM encryption key (64 hex chars) | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `API_KEY`        | String | Optional | Internal API authentication               | `internal-api-key-xxx`                                             |

**Generate Secure Keys:**

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (64 hex characters)
openssl rand -hex 32
```

### Database

| Variable       | Type   | Required | Description                | Example                |
| -------------- | ------ | -------- | -------------------------- | ---------------------- |
| `DATABASE_URL` | String | Yes      | Database connection string | `file:./prisma/dev.db` |

**Supported Databases:**

- SQLite (default, recommended for local/dev)
- PostgreSQL (production)
- MySQL (production)

### Monitoring & Error Tracking

| Variable     | Type   | Required | Description               | Example                     |
| ------------ | ------ | -------- | ------------------------- | --------------------------- |
| `SENTRY_DSN` | String | Optional | Sentry error tracking DSN | `https://xxx@sentry.io/123` |

---

## Configuration Files

### .env (Environment Variables)

**Location:** `/home/jlguo/agent-hub/.env`

**Example:**

```bash
# Feishu
FEISHU_APP_ID=cli_a930b22377b9dcd6
FEISHU_APP_SECRET=CbnapLyCprizpwj0DC4RZkpSGb1HFiMR
FEISHU_CHAT_ID=oc_ca9b129b5264ac7b79a569d0dd0b1022
FEISHU_VERIFY_TOKEN=agent-hub-verify-token

# OpenClaw
OPENCLAW_MODE=cli
OPENCLAW_VERIFICATION_TOKEN=4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468

# Security
JWT_SECRET=super-secret-jwt-key-min-32-chars-long
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Database
DATABASE_URL=file:./prisma/dev.db

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/123
```

### openclaw.config.json (OpenClaw Configuration)

**Location:** `~/.openclaw/openclaw.json`

**Example:**

```json
{
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468"
    }
  },
  "models": {
    "default": "qwen3.5-plus",
    "fallback": ["qwen3-max-2026-01-23", "qwen3-coder-next"]
  }
}
```

### prisma/schema.prisma (Database Schema)

**Location:** `/home/jlguo/agent-hub/prisma/schema.prisma`

**Models:**

- Room - Conversation spaces
- Agent - AI bot configurations
- Relationship - Agent relationships
- Message - All messages (human + agent)
- Discussion - Topic threads with heat tracking
- Session - OpenClaw gateway sessions

---

## OpenClaw Modes

### CLI Mode (Recommended for Local/Dev)

**Configuration:**

```bash
OPENCLAW_MODE=cli
```

**Pros:**

- Simple setup
- No network configuration
- Works offline
- Best for development

**Cons:**

- Requires local OpenClaw installation
- No remote gateway support

**Requirements:**

- OpenClaw CLI installed (`npm install -g openclaw`)
- Local agent configurations in `~/.openclaw/agents/`

### HTTP Mode

**Configuration:**

```bash
OPENCLAW_MODE=http
OPENCLAW_GATEWAY_URL=http://localhost:18789
OPENCLAW_VERIFICATION_TOKEN=your-token
```

**Pros:**

- Centralized gateway
- Multiple agents can share gateway
- Better for production

**Cons:**

- Requires running OpenClaw Gateway
- Network configuration needed
- Authentication required

**Requirements:**

- OpenClaw Gateway running
- Valid verification token
- Network access to gateway

### Remote Mode (SSH Tunnel)

**Configuration:**

```bash
OPENCLAW_MODE=remote
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_VERIFICATION_TOKEN=your-token
```

**Pros:**

- Secure remote access
- Works behind firewall
- Encrypted connection

**Cons:**

- Requires SSH tunnel
- More complex setup
- Tunnel maintenance needed

**Requirements:**

- SSH access to remote host
- SSH tunnel configured
- Remote OpenClaw Gateway running

**SSH Tunnel Setup:**

```bash
# Manual tunnel
ssh -L 18789:localhost:18789 user@remote-host

# Persistent tunnel (systemd)
sudo systemctl enable openclaw-tunnel
sudo systemctl start openclaw-tunnel
```

---

## Security Configuration

### JWT Authentication

**Purpose:** Secure admin endpoints and API access

**Configuration:**

```bash
JWT_SECRET=super-secret-jwt-key-min-32-chars-long
```

**Best Practices:**

- Use at least 32 characters
- Include uppercase, lowercase, numbers, symbols
- Rotate every 90 days
- Use different secrets per environment

**Generate:**

```bash
openssl rand -base64 32
```

### Data Encryption

**Purpose:** Encrypt sensitive data at rest

**Configuration:**

```bash
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**Algorithm:** AES-256-GCM

**Best Practices:**

- Use 64 hex characters (256 bits)
- Store securely (not in code)
- Rotate annually
- Backup securely

**Generate:**

```bash
openssl rand -hex 32
```

### API Key Authentication

**Purpose:** Internal service-to-service authentication

**Configuration:**

```bash
API_KEY=internal-api-key-xxx
```

**Usage:**

- Include in API requests: `Authorization: Bearer <API_KEY>`
- Validate on server side
- Rotate regularly

---

## Database Configuration

### SQLite (Default)

**Connection String:**

```bash
DATABASE_URL=file:./prisma/dev.db
```

**Pros:**

- Simple setup
- No additional services
- Good for local/dev

**Cons:**

- Limited concurrency
- No clustering
- Backup requires file copy

**Optimization:**

```bash
# Enable WAL mode for better concurrency
PRAGMA journal_mode=WAL;

# Regular VACUUM
PRAGMA auto_vacuum=FULL;
```

### PostgreSQL (Production)

**Connection String:**

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/agent_hub?schema=public
```

**Pros:**

- High concurrency
- Clustering support
- Advanced features

**Cons:**

- Requires PostgreSQL server
- More complex setup
- Additional maintenance

**Setup:**

```bash
# Install PostgreSQL
sudo apt install postgresql

# Create database
createdb agent_hub

# Create user
createuser -P agent_hub_user

# Run migrations
npx prisma migrate deploy
```

---

## Monitoring Configuration

### Health Endpoints

**Basic Health:**

```bash
curl http://localhost:4000/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-07T12:00:00.000Z",
  "uptime": 3600,
  "openclaw": {
    "status": "healthy",
    "mode": "cli"
  }
}
```

**Detailed Health:**

```bash
curl http://localhost:4000/health/detailed
```

**Metrics:**

```bash
curl http://localhost:4000/metrics
```

### Prometheus Metrics

**Key Metrics:**

- `http_request_duration_seconds` - HTTP request latency
- `openclaw_request_duration_seconds` - OpenClaw execution time
- `agent_response_duration_seconds` - Agent response time
- `database_query_duration_seconds` - Database query time
- `error_total` - Error count

**Scrape Configuration:**

```yaml
scrape_configs:
  - job_name: 'agent-hub'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Alerting Rules

**Critical Alerts:**

```yaml
groups:
  - name: agent-hub
    rules:
      - alert: BackendDown
        expr: up{job="agent-hub"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'Agent Hub backend is down'

      - alert: HighErrorRate
        expr: rate(error_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
```

---

## Remote Access Configuration

### SSH Tunnel

**Manual Tunnel:**

```bash
ssh -N -L 18789:localhost:18789 user@remote-host
```

**Persistent Tunnel (systemd):**

Create `/etc/systemd/system/openclaw-tunnel.service`:

```ini
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

**Enable and Start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw-tunnel
sudo systemctl start openclaw-tunnel
```

### Tailscale

**For Tailscale Networks:**

```bash
# Enable Tailscale serve
tailscale serve https --terminate-proxy --proxy-to=http://localhost:4000 4000

# Access via Tailscale
curl https://your-machine.tailnet-name.ts.net
```

---

## Troubleshooting Configuration

### Common Issues

**1. Missing Environment Variables**

```bash
# Check which variables are set
env | grep -E 'FEISHU|OPENCLAW|JWT|ENCRYPTION'

# Check .env file
cat .env
```

**2. Invalid Token Format**

```bash
# Verify token length
echo -n "$JWT_SECRET" | wc -c  # Should be >= 32

# Verify encryption key format
echo "$ENCRYPTION_KEY" | grep -E '^[0-9a-f]{64}$'  # Should match
```

**3. Database Connection Failed**

```bash
# Check database file exists
ls -la prisma/dev.db

# Check permissions
chmod 644 prisma/dev.db

# Run migrations
npx prisma migrate deploy
```

**4. OpenClaw Mode Errors**

```bash
# Verify mode is valid
echo $OPENCLAW_MODE  # Should be: cli, http, or remote

# Check CLI installation
openclaw --version

# Check gateway accessibility
curl http://$OPENCLAW_GATEWAY_URL/health
```

### Validation Script

```bash
#!/bin/bash
# validate-config.sh

echo "Validating configuration..."

# Check .env file
if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Check required variables
required_vars=(
  "FEISHU_APP_ID"
  "FEISHU_APP_SECRET"
  "FEISHU_CHAT_ID"
  "FEISHU_VERIFY_TOKEN"
  "OPENCLAW_MODE"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ $var is not set"
    exit 1
  fi
done

# Check JWT_SECRET length
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ JWT_SECRET must be at least 32 characters"
  exit 1
fi

# Check ENCRYPTION_KEY format
if ! [[ $ENCRYPTION_KEY =~ ^[0-9a-f]{64}$ ]]; then
  echo "❌ ENCRYPTION_KEY must be 64 hex characters"
  exit 1
fi

echo "✅ Configuration validated successfully"
```

---

## Best Practices

### Environment Management

1. **Use .env Files Per Environment**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

2. **Never Commit Secrets**
   - Add `.env` to `.gitignore`
   - Use secrets management (Vault, AWS Secrets Manager)
   - Use CI/CD secrets for deployment

3. **Rotate Regularly**
   - JWT secrets: Every 90 days
   - Encryption keys: Annually
   - API keys: Every 60 days

### Security

1. **Use Strong Secrets**
   - Minimum 32 characters for JWT
   - 64 hex characters for encryption
   - Include mixed case, numbers, symbols

2. **Limit Access**
   - Use different secrets per environment
   - Restrict database access
   - Use network policies

3. **Monitor and Audit**
   - Log all authentication attempts
   - Monitor for unusual activity
   - Regular security audits

### Performance

1. **Database Optimization**
   - Enable WAL mode (SQLite)
   - Add indexes for frequent queries
   - Regular VACUUM/ANALYZE

2. **Connection Pooling**
   - Use Prisma connection pool
   - Configure pool size based on load
   - Monitor connection usage

3. **Caching**
   - Cache frequently accessed data
   - Use Redis for shared cache
   - Set appropriate TTLs

---

## Support

**Documentation:**

- Deployment: `docs/DEPLOYMENT.md`
- Architecture: `ARCHITECTURE.md`
- Features: `docs/FEATURES.md`
- Troubleshooting: `TROUBLESHOOTING-GUIDE.md`

**Last Reviewed:** 2026-04-07  
**Next Review:** 2026-05-07
