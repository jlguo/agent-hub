# OpenClaw Remote Access Setup Guide

**Official Method: SSH Tunnel + WebSocket CLI**

---

## Architecture

```
┌─────────────────┐         SSH Tunnel          ┌──────────────────┐
│  Agent Hub      │  ────────────────────────>  │  OpenClaw        │
│  Backend        │  ws://127.0.0.1:18789       │  Gateway         │
│  (Docker/VPS)   │                             │  (Remote Host)   │
└─────────────────┘                             └──────────────────┘
```

**Key Points:**

- OpenClaw Gateway runs on remote host (VPS/home server)
- Gateway binds to loopback only (`gateway.bind: "loopback"`)
- SSH tunnel forwards local port 18789 to remote Gateway
- Agent Hub CLI connects via WebSocket through tunnel

---

## Prerequisites

1. **Remote OpenClaw Gateway** running on VPS/home server
2. **SSH access** to remote host
3. **OpenClaw CLI** installed on Agent Hub host
4. **Gateway token** for authentication

---

## Step 1: Configure Remote OpenClaw Gateway

On your **remote host** (VPS/home server):

```bash
# Check current config
openclaw config get gateway.bind
openclaw config get gateway.auth.token

# Should be:
# gateway.bind: "loopback"
# gateway.auth.token: "your-secure-token"
```

If not configured:

```bash
# Set loopback binding (secure default)
openclaw config set gateway.bind "loopback"

# Set auth token
openclaw config set gateway.auth.token "your-secure-token"

# Restart gateway
openclaw gateway restart
```

---

## Step 2: Configure Agent Hub for Remote Mode

On your **Agent Hub host** (where backend runs):

### Option A: CLI Configuration (Recommended)

```bash
# Configure remote gateway
openclaw config set gateway.mode "remote"
openclaw config set gateway.remote.url "ws://127.0.0.1:18789"
openclaw config set gateway.remote.token "your-secure-token"

# Verify configuration
openclaw config get gateway
```

### Option B: Environment Variables (Docker)

```bash
# For docker-compose.yml
OPENCLAW_MODE=remote
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_VERIFICATION_TOKEN=your-secure-token
```

---

## Step 3: Setup SSH Tunnel

### Option A: Manual SSH Tunnel (Testing)

```bash
# Create tunnel (keeps running in foreground)
ssh -N -L 18789:127.0.0.1:18789 user@remote-host

# Test connection
openclaw health
openclaw status
```

### Option B: Persistent SSH Tunnel (Production - Linux)

Create systemd service:

```bash
sudo nano /etc/systemd/system/openclaw-ssh-tunnel.service
```

```ini
[Unit]
Description=OpenClaw SSH Tunnel
After=network.target

[Service]
Type=simple
User=your-user
ExecStart=/usr/bin/ssh -N -o ServerAliveInterval=60 -o ExitOnForwardFailure=yes -L 18789:127.0.0.1:18789 user@remote-host
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable openclaw-ssh-tunnel
sudo systemctl start openclaw-ssh-tunnel
sudo systemctl status openclaw-ssh-tunnel
```

### Option C: Persistent SSH Tunnel (macOS)

Create LaunchAgent:

```bash
nano ~/Library/LaunchAgents/ai.openclaw.ssh-tunnel.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>-o</string>
        <string>ServerAliveInterval=60</string>
        <string>-o</string>
        <string>ExitOnForwardFailure=yes</string>
        <string>-L</string>
        <string>18789:127.0.0.1:18789</string>
        <string>user@remote-host</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

```bash
# Load the LaunchAgent
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.openclaw.ssh-tunnel.plist

# Check status
launchctl list | grep openclaw
```

### Option D: SSH Config (Simplified)

Add to `~/.ssh/config`:

```ssh
Host openclaw-remote
    HostName remote-host-ip
    User your-user
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ExitOnForwardFailure yes
```

Then use:

```bash
ssh -N openclaw-remote
```

---

## Step 4: Docker Integration

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    image: agent-hub-backend:latest
    environment:
      # OpenClaw remote mode
      OPENCLAW_MODE: remote
      OPENCLAW_GATEWAY_URL: ws://127.0.0.1:18789
      OPENCLAW_VERIFICATION_TOKEN: ${OPENCLAW_VERIFICATION_TOKEN}

      # Other config
      DATABASE_URL: file:/app/prisma/dev.db
      FEISHU_APP_ID: ${FEISHU_APP_ID}
      FEISHU_APP_SECRET: ${FEISHU_APP_SECRET}
      FEISHU_CHAT_ID: ${FEISHU_CHAT_ID}

    volumes:
      # Mount OpenClaw config
      - ~/.openclaw:/root/.openclaw:ro
      - ./prisma:/app/prisma
    ports:
      - '4000:4000'

    depends_on:
      - ssh-tunnel

  # SSH tunnel sidecar container
  ssh-tunnel:
    image: alpine/ssh:latest
    environment:
      SSH_HOST: ${SSH_HOST}
      SSH_USER: ${SSH_USER}
      SSH_PORT: ${SSH_PORT:-22}
      SSH_KEY: ${SSH_KEY}
    volumes:
      - ./ssh-key:/root/.ssh/id_rsa:ro
    command: >
      sh -c "
        echo '$SSH_KEY' > /root/.ssh/id_rsa &&
        chmod 600 /root/.ssh/id_rsa &&
        ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -N -L 18789:${SSH_HOST}:18789 ${SSH_USER}@${SSH_HOST}
      "
    restart: always
    networks:
      - internal

networks:
  internal:
    internal: true
```

### .env Example

```bash
# OpenClaw Remote Access
OPENCLAW_MODE=remote
OPENCLAW_VERIFICATION_TOKEN=your-secure-token

# SSH Tunnel
SSH_HOST=your-remote-host-ip
SSH_USER=your-username
SSH_PORT=22
SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----\n..."

# Feishu
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_CHAT_ID=oc_xxx
```

---

## Step 5: Verification

### Test SSH Tunnel

```bash
# Check if tunnel is running
lsof -i :18789

# Should show ssh process listening on port 18789
```

### Test OpenClaw Connection

```bash
# Health check
openclaw health

# Expected output:
# ✅ Gateway health: ok

# Status check
openclaw status

# Expected: Gateway status with session info

# Test agent invocation
openclaw agent --message "Hello" --agent "family-mom" --session-id "test-session"

# Expected: Agent response
```

### Test Agent Hub Backend

```bash
# Start backend
docker-compose up -d backend

# Check logs
docker-compose logs -f backend

# Should see:
# [OpenClawService] Mode: REMOTE
# [OpenClawService] Gateway URL: ws://127.0.0.1:18789
# [OpenClawService] ✅ Connected to remote gateway
```

---

## Troubleshooting

### SSH Tunnel Won't Start

```bash
# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa

# Test SSH connection
ssh -v user@remote-host

# Check if port is already in use
lsof -i :18789

# Kill existing process
kill -9 $(lsof -ti:18789)
```

### Gateway Connection Fails

```bash
# Verify gateway is running on remote
ssh user@remote-host "openclaw gateway status"

# Check gateway config
openclaw config get gateway.bind
# Should be: loopback

# Check auth token matches
openclaw config get gateway.auth.token
```

### Docker Can't Connect

```bash
# Check SSH tunnel container
docker-compose logs ssh-tunnel

# Verify tunnel is running inside Docker network
docker-compose exec backend lsof -i :18789

# Test from inside container
docker-compose exec backend openclaw health
```

### Agent Responses Slow

```bash
# Check SSH latency
ping remote-host

# Check SSH tunnel performance
ssh -N -v -L 18789:127.0.0.1:18789 user@remote-host

# Consider using Tailscale instead of SSH for better performance
```

---

## Alternative: Tailscale (No SSH Tunnel)

If you prefer Tailscale over SSH:

### On Remote Host

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate
tailscale up

# Note the Tailscale IP (e.g., 100.x.x.x)
tailscale ip
```

### On Agent Hub Host

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate
tailscale up

# Configure remote gateway with Tailscale IP
openclaw config set gateway.remote.url "ws://100.x.x.x:18789"
openclaw config set gateway.remote.token "your-token"
```

### Docker with Tailscale

```yaml
services:
  backend:
    image: agent-hub-backend:latest
    environment:
      OPENCLAW_MODE: remote
      OPENCLAW_GATEWAY_URL: ws://100.x.x.x:18789 # Tailscale IP
      OPENCLAW_VERIFICATION_TOKEN: ${OPENCLAW_VERIFICATION_TOKEN}
    network_mode: host # Use host network for Tailscale
```

---

## Security Best Practices

1. **Use SSH keys, not passwords**

   ```bash
   ssh-keygen -t ed25519 -C "openclaw-tunnel"
   ssh-copy-id -i ~/.ssh/id_ed25519.pub user@remote-host
   ```

2. **Restrict SSH access**

   ```bash
   # On remote host, /etc/ssh/sshd_config
   AllowUsers your-user
   PermitRootLogin no
   PasswordAuthentication no
   ```

3. **Use strong gateway token**

   ```bash
   # Generate secure token
   openssl rand -hex 32

   # Set in config
   openclaw config set gateway.auth.token "generated-token"
   ```

4. **Monitor tunnel status**

   ```bash
   # systemd
   systemctl status openclaw-ssh-tunnel

   # macOS
   launchctl list | grep openclaw
   ```

5. **Enable firewall on remote host**
   ```bash
   # Only allow SSH from trusted IPs
   ufw allow from 1.2.3.4 to any port 22
   ufw enable
   ```

---

## Migration from HTTP Mode

If you were using our previous HTTP mode implementation:

### 1. Update Configuration

**Before (HTTP Mode - Doesn't Work):**

```bash
OPENCLAW_MODE=http
OPENCLAW_GATEWAY_URL=http://remote-host:18789
OPENCLAW_VERIFICATION_TOKEN=xxx
```

**After (Remote CLI Mode - Official):**

```bash
OPENCLAW_MODE=remote
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789  # Through SSH tunnel
OPENCLAW_VERIFICATION_TOKEN=xxx
```

### 2. Setup SSH Tunnel

```bash
# Add persistent tunnel (see Step 3 above)
sudo systemctl enable openclaw-ssh-tunnel
sudo systemctl start openclaw-ssh-tunnel
```

### 3. Update OpenClawService.ts

The existing CLI mode already works - no code changes needed!

```typescript
// OpenClawService.ts already supports remote mode via CLI config
// Just configure: openclaw config set gateway.mode remote
```

---

## References

- Official OpenClaw Remote Access: https://docs.openclaw.ai/gateway/remote
- OpenClaw Gateway Configuration: https://docs.openclaw.ai/gateway/configuration
- OpenClaw Security: https://docs.openclaw.ai/gateway/security
- Tailscale Integration: https://docs.openclaw.ai/gateway/tailscale

---

**Last Updated:** 2026-04-04  
**Status:** Ready for implementation
