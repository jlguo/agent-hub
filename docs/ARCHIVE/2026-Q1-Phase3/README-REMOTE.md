# Docker Remote Mode Deployment Guide

**Quick Start:** Deploy Agent Hub with remote OpenClaw Gateway access using SSH tunnel sidecar.

---

## Architecture

```
┌─────────────────────┐
│  Docker Compose     │
│  ┌───────────────┐  │
│  │    Backend    │  │
│  │  (Port 4000)  │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ SSH Tunnel    │  │
│  │ Sidecar       │──┼── SSH ──> Remote OpenClaw Gateway
│  │ (Port 18789)  │  │
│  └───────────────┘  │
└─────────────────────┘
```

---

## Prerequisites

1. **Remote OpenClaw Gateway** running on VPS/home server
2. **SSH access** to remote host with key-based auth
3. **Docker & Docker Compose** installed
4. **OpenClaw CLI** (for initial setup/testing)

---

## Quick Start (5 minutes)

### Step 1: Clone & Setup

```bash
cd /home/jlguo/agent-hub

# Copy example env
cp .env.remote.example .env

# Edit with your values
nano .env
```

### Step 2: Setup SSH Key

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "agent-hub-docker" -f ./ssh-key

# Copy to remote host
ssh-copy-id -i ./ssh-key ${SSH_USER}@${SSH_HOST}

# Set correct permissions
chmod 600 ./ssh-key
```

### Step 3: Test SSH Tunnel Locally

```bash
# Test SSH connection (manual)
ssh -N -L 18789:${SSH_HOST}:18789 ${SSH_USER}@${SSH_HOST}

# In another terminal, test OpenClaw
openclaw health

# Should return: Gateway health: ok
```

### Step 4: Start Docker Compose

```bash
# Build and start
docker-compose -f docker-compose.remote.yml up -d

# Check status
docker-compose -f docker-compose.remote.yml ps

# View logs
docker-compose -f docker-compose.remote.yml logs -f
```

### Step 5: Verify Health

```bash
# Check backend health
curl http://localhost:4000/health

# Expected output:
# {
#   "status": "ok",
#   "openclaw": {
#     "status": "healthy",
#     "mode": "remote",
#     "tunnel": "connected"
#   }
# }
```

---

## Configuration

### Required Environment Variables

| Variable                      | Description            | Example         |
| ----------------------------- | ---------------------- | --------------- |
| `OPENCLAW_MODE`               | Must be `remote`       | `remote`        |
| `OPENCLAW_VERIFICATION_TOKEN` | Gateway auth token     | `abc123...`     |
| `SSH_HOST`                    | Remote host IP/domain  | `192.168.1.100` |
| `SSH_USER`                    | SSH username           | `ubuntu`        |
| `SSH_PORT`                    | SSH port (default: 22) | `22`            |
| `FEISHU_APP_ID`               | Feishu app ID          | `cli_xxx`       |
| `FEISHU_APP_SECRET`           | Feishu app secret      | `xxx`           |
| `FEISHU_CHAT_ID`              | Target chat ID         | `oc_xxx`        |

### Optional Environment Variables

| Variable         | Description        | Default                   |
| ---------------- | ------------------ | ------------------------- |
| `SSH_PORT`       | SSH port           | `22`                      |
| `LOG_LEVEL`      | Logging verbosity  | `info`                    |
| `JWT_SECRET`     | JWT signing key    | (required for admin)      |
| `ENCRYPTION_KEY` | AES encryption key | (required for encryption) |

---

## Container Details

### Backend Service

- **Image:** `agent-hub-backend:latest`
- **Port:** 4000
- **Health Check:** `/health` endpoint
- **Restart Policy:** `unless-stopped`
- **Volumes:**
  - `~/.openclaw:/root/.openclaw:ro` - OpenClaw config
  - `./prisma-data:/app/prisma` - Database persistence
  - `./logs:/app/logs` - Log files

### SSH Tunnel Sidecar

- **Image:** `alpine/ssh:latest` (or custom build)
- **Port:** 18789 (internal only)
- **Health Check:** Port 18789 listening
- **Restart Policy:** `unless-stopped`
- **Volumes:**
  - `./ssh-key:/root/.ssh/id_rsa:ro` - SSH private key
  - `./ssh-known_hosts:/root/.ssh/known_hosts:ro` - Known hosts (optional)

---

## Monitoring

### Check Container Status

```bash
# All containers
docker-compose -f docker-compose.remote.yml ps

# Detailed status
docker-compose -f docker-compose.remote.yml ps -a

# Check health status
docker-compose -f docker-compose.remote.yml ps --format "table {{.Name}}\t{{.Status}}"
```

### View Logs

```bash
# All logs
docker-compose -f docker-compose.remote.yml logs -f

# Backend only
docker-compose -f docker-compose.remote.yml logs -f backend

# SSH tunnel only
docker-compose -f docker-compose.remote.yml logs -f ssh-tunnel

# Last 100 lines
docker-compose -f docker-compose.remote.yml logs --tail=100
```

### Health Check Endpoint

```bash
# Full health with OpenClaw status
curl http://localhost:4000/health | jq

# Just OpenClaw status
curl http://localhost:4000/health | jq .openclaw
```

---

## Troubleshooting

### SSH Tunnel Not Connecting

**Symptom:** SSH tunnel container keeps restarting

```bash
# Check logs
docker-compose -f docker-compose.remote.yml logs ssh-tunnel

# Common issues:
# 1. SSH key permissions wrong
chmod 600 ./ssh-key

# 2. SSH key not copied to remote
ssh-copy-id -i ./ssh-key ${SSH_USER}@${SSH_HOST}

# 3. Remote host unreachable
ping ${SSH_HOST}

# 4. Wrong SSH username
ssh ${SSH_USER}@${SSH_HOST}
```

### Backend Can't Connect to OpenClaw

**Symptom:** `/health` shows `tunnel: disconnected`

```bash
# Check if tunnel is running
docker-compose -f docker-compose.remote.yml exec ssh-tunnel nc -z localhost 18789

# Should return: Connection successful

# Test from backend
docker-compose -f docker-compose.remote.yml exec backend wget -q -O - http://localhost:18789

# Check OpenClaw config
docker-compose -f docker-compose.remote.yml exec backend openclaw config get gateway.remote
```

### OpenClaw Gateway Not Responding

**Symptom:** Health check returns unhealthy

```bash
# SSH to remote host and check gateway
ssh ${SSH_USER}@${SSH_HOST} "openclaw gateway status"

# Should show gateway running

# Restart gateway on remote
ssh ${SSH_USER}@${SSH_HOST} "openclaw gateway restart"
```

### Database Permission Errors

**Symptom:** Can't write to database

```bash
# Fix permissions
sudo chown -R 1000:1000 ./prisma-data
chmod -R 755 ./prisma-data
```

---

## Advanced Configuration

### Custom SSH Tunnel Image

Build custom SSH tunnel image with additional tools:

```bash
cd docker/ssh-tunnel
docker build -t agent-hub-ssh-tunnel:latest .
```

Update `docker-compose.remote.yml`:

```yaml
ssh-tunnel:
  image: agent-hub-ssh-tunnel:latest
  # ... rest of config
```

### Persistent SSH Known Hosts

For extra security, pre-populate known hosts:

```bash
# Get remote host key
ssh-keyscan -H ${SSH_HOST} > ./ssh-known_hosts

# Mount in docker-compose.yml (already configured)
volumes:
  - ./ssh-known_hosts:/root/.ssh/known_hosts:ro
```

### Multiple Remote Gateways

For high availability, setup multiple tunnels:

```yaml
ssh-tunnel-primary:
  # ... primary config

ssh-tunnel-secondary:
  # ... secondary config
  environment:
    SSH_HOST: secondary-host
```

---

## Security Best Practices

1. **Use SSH key authentication only** (no passwords)

   ```bash
   ssh-keygen -t ed25519 -C "agent-hub"
   ```

2. **Restrict SSH key usage** (in `~/.ssh/authorized_keys` on remote):

   ```
   from="192.168.1.*",command="openclaw gateway" ssh-ed25519 AAAA...
   ```

3. **Use strong OpenClaw token**:

   ```bash
   openssl rand -hex 32
   ```

4. **Enable firewall on remote host**:

   ```bash
   ufw allow from 192.168.1.0/24 to any port 22
   ```

5. **Regular security updates**:
   ```bash
   docker-compose -f docker-compose.remote.yml pull
   docker-compose -f docker-compose.remote.yml up -d
   ```

---

## Backup & Recovery

### Backup Database

```bash
# Stop containers
docker-compose -f docker-compose.remote.yml down

# Backup database
cp -r ./prisma-data ./prisma-data.backup-$(date +%Y%m%d)

# Restart
docker-compose -f docker-compose.remote.yml up -d
```

### Restore from Backup

```bash
# Stop containers
docker-compose -f docker-compose.remote.yml down

# Restore database
rm -rf ./prisma-data
cp -r ./prisma-data.backup-20260405 ./prisma-data

# Restart
docker-compose -f docker-compose.remote.yml up -d
```

---

## Performance Tuning

### Increase SSH Keepalive

For unstable networks, increase keepalive in `docker-compose.remote.yml`:

```yaml
ssh-tunnel:
  command: >
    sh -c "
      ssh -o ServerAliveInterval=30
          -o ServerAliveCountMax=5
          ...
    "
```

### Resource Limits

Prevent container from using too many resources:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

---

## Migration from Local Mode

### Step 1: Backup Current Setup

```bash
# Backup database
cp -r ./prisma-data ./prisma-data.backup

# Backup current config
cp .env .env.local.backup
```

### Step 2: Update Configuration

```bash
# Copy remote example
cp .env.remote.example .env

# Edit with your values
nano .env
```

### Step 3: Test Remote Connection

```bash
# Test SSH tunnel manually
ssh -N -L 18789:${SSH_HOST}:18789 ${SSH_USER}@${SSH_HOST}

# Test OpenClaw
openclaw health
```

### Step 4: Deploy with Docker

```bash
docker-compose -f docker-compose.remote.yml up -d
```

### Step 5: Verify

```bash
# Check health
curl http://localhost:4000/health

# Test agent
openclaw agent --message "test" --agent "family-mom"
```

---

## References

- [OpenClaw Remote Access Docs](https://docs.openclaw.ai/gateway/remote)
- [OPENCLAW-REMOTE-SETUP.md](docs/OPENCLAW-REMOTE-SETUP.md)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [SSH Tunnel Best Practices](https://www.ssh.com/academy/ssh/tunneling)

---

**Last Updated:** 2026-04-05  
**Status:** Production Ready
