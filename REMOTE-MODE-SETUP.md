# Agent Hub - Remote Mode Deployment Guide

## Quick Start

### 1. Configure Environment

```bash
# Copy the remote mode template
cp .env.remote.example .env

# Edit .env with your values
nano .env
```

### 2. Required Configuration

**OpenClaw Remote Access:**

```bash
OPENCLAW_MODE=remote
OPENCLAW_VERIFICATION_TOKEN=your-actual-token
```

**SSH Tunnel (Required for Remote Mode):**

```bash
SSH_HOST=your-remote-host.com      # IP or domain of OpenClaw Gateway host
SSH_USER=your-username              # SSH username
SSH_PORT=22                         # SSH port (default: 22)
```

**Feishu Integration:**

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
FEISHU_VERIFY_TOKEN=your-token
```

### 3. Generate SSH Key (if needed)

```bash
# Generate SSH key for tunnel authentication
ssh-keygen -t ed25519 -f ./ssh-key -N "" -C "agent-hub"

# Copy public key to remote host
ssh-copy-id -i ./ssh-key.pub ${SSH_USER}@${SSH_HOST}

# Set correct permissions
chmod 600 ./ssh-key
```

### 4. Deploy with Remote Mode

```bash
# Start with remote mode compose file
docker-compose -f docker-compose.remote.yml up -d

# Check status
docker-compose -f docker-compose.remote.yml ps

# View logs
docker-compose -f docker-compose.remote.yml logs -f backend
docker-compose -f docker-compose.remote.yml logs -f ssh-tunnel
```

### 5. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:4000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-04-08T...",
  "uptime": 123.45,
  "openclaw": {
    "status": "healthy",
    "mode": "remote",
    "tunnel": "connected"
  }
}
```

## Architecture

```
┌─────────────────┐
│ Agent Hub       │
│ Backend         │
│ (Docker)        │
└────────┬────────┘
         │
         │ localhost:18789
         │
┌────────▼────────┐
│ SSH Tunnel      │
│ Sidecar         │
│ (Alpine/SSH)    │
└────────┬────────┘
         │
         │ Encrypted SSH Tunnel
         │ -L 18789:remote-host:18789
         │
         ▼
┌─────────────────┐
│ Remote Host     │
│ OpenClaw        │
│ Gateway         │
│ ws://:18789     │
└─────────────────┘
```

## Configuration Files

### docker-compose.remote.yml

Includes:

- **backend**: Agent Hub backend service
- **ssh-tunnel**: SSH tunnel sidecar container
- **internal**: Private network for inter-service communication

### .env Variables

| Variable                    | Required | Description             |
| --------------------------- | -------- | ----------------------- |
| OPENCLAW_MODE               | Yes      | Must be "remote"        |
| OPENCLAW_VERIFICATION_TOKEN | Yes      | Token for OpenClaw auth |
| SSH_HOST                    | Yes      | Remote host IP/domain   |
| SSH_USER                    | Yes      | SSH username            |
| SSH_PORT                    | No       | SSH port (default: 22)  |
| FEISHU\_\*                  | Optional | Feishu integration      |
| JWT_SECRET                  | Optional | JWT signing secret      |
| ENCRYPTION_KEY              | Optional | AES-256 encryption key  |

## Troubleshooting

### SSH Tunnel Failing

```bash
# Check tunnel logs
docker-compose -f docker-compose.remote.yml logs ssh-tunnel

# Test SSH connection manually
ssh -i ./ssh-key -L 18789:localhost:18789 ${SSH_USER}@${SSH_HOST}

# Verify SSH key permissions
chmod 600 ./ssh-key
```

### OpenClaw Health Check Failing

```bash
# Check backend logs
docker-compose -f docker-compose.remote.yml logs backend

# Verify tunnel is connected
docker exec agent-hub-backend-1 nc -zv localhost 18789

# Test OpenClaw health
docker exec agent-hub-backend-1 wget -qO- http://localhost:4000/health
```

### Database Issues

```bash
# Check database file
docker exec agent-hub-backend-1 ls -la /app/prisma/dev.db

# If empty, restart to trigger initialization
docker-compose -f docker-compose.remote.yml restart backend
```

## Alternative: CLI Mode

If you don't have remote OpenClaw Gateway access, use CLI mode:

```bash
# Use standard docker-compose.yml
docker-compose up -d

# Note: OpenClaw CLI must be installed in Dockerfile
# Or use local development: ./start.sh
```

## Security Notes

- SSH tunnel provides encryption for all OpenClaw traffic
- Keep SSH private key secure (chmod 600)
- Use strong tokens for OPENCLAW_VERIFICATION_TOKEN
- Rotate JWT_SECRET and ENCRYPTION_KEY regularly
- Consider using Tailscale for secure network access instead of SSH

## Next Steps

1. ✅ Configure .env with actual values
2. ✅ Generate SSH key and copy to remote host
3. ✅ Deploy with docker-compose.remote.yml
4. ✅ Verify health endpoint
5. ✅ Test agent responses
6. ✅ Configure Feishu integration (optional)
