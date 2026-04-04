# OpenClaw Integration - Dual Mode Support

**Supports both HTTP Gateway API and CLI**

---

## Architecture

```
┌──────────────┐
│  Agent Hub   │
│              │
│  ┌──────────────────────────────────────┐
│  │     OpenClawService                  │
│  │                                      │
│  │  ┌──────────────┐  ┌──────────────┐ │
│  │  │ HTTP Gateway │  │     CLI      │ │
│  │  │   (Mode 1)   │  │   (Mode 2)   │ │
│  │  │              │  │              │ │
│  │  │ - REST API   │  │ - Local exec │ │
│  │  │ - Token auth │  │ - No auth    │ │
│  │  │ - Remote OK  │  │ - Local only │ │
│  │  └──────────────┘  └──────────────┘ │
│  └──────────────────────────────────────┘
└──────────────┘
```

---

## Configuration

### Environment Variable

```bash
# Choose integration mode
OPENCLAW_MODE=remote     # Use remote CLI (official method, recommended)
OPENCLAW_MODE=cli        # Use local CLI (default for local dev)
OPENCLAW_MODE=http       # ❌ DEPRECATED - HTTP API not supported by OpenClaw Gateway

# Remote Mode settings (official OpenClaw pattern)
# Configure via CLI (recommended):
#   openclaw config set gateway.mode remote
#   openclaw config set gateway.remote.url ws://127.0.0.1:18789
#   openclaw config set gateway.remote.token your-token
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789  # Through SSH tunnel
OPENCLAW_VERIFICATION_TOKEN=xxx

# CLI Mode settings (no extra config needed)
# Uses openclaw CLI from PATH
```

### Remote Mode Setup (Official OpenClaw Method)

**Architecture:**

```
Agent Hub Backend → SSH Tunnel → OpenClaw Gateway (Remote)
ws://127.0.0.1:18789            ws://remote-host:18789
```

**Steps:**

1. **Setup SSH Tunnel** (persistent):

   ```bash
   # Linux (systemd)
   sudo systemctl enable openclaw-ssh-tunnel
   sudo systemctl start openclaw-ssh-tunnel

   # macOS (LaunchAgent)
   launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.openclaw.ssh-tunnel.plist
   ```

2. **Configure OpenClaw CLI**:

   ```bash
   openclaw config set gateway.mode remote
   openclaw config set gateway.remote.url ws://127.0.0.1:18789
   openclaw config set gateway.remote.token your-token
   ```

3. **Verify Connection**:
   ```bash
   openclaw health
   openclaw agent --message "test" --agent "family-mom"
   ```

**See Full Guide:** [`OPENCLAW-REMOTE-SETUP.md`](OPENCLAW-REMOTE-SETUP.md)

---

## Implementation Plan

### 1. OpenClawService.ts Updates

**Current**: CLI only
**New**: Dual mode with auto-detection

```typescript
export class OpenClawService {
  private mode: 'http' | 'cli';
  private gatewayUrl?: string;
  private verificationToken?: string;

  constructor() {
    this.mode = (process.env.OPENCLAW_MODE as 'http' | 'cli') || 'cli';
    this.gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    this.verificationToken = process.env.OPENCLAW_VERIFICATION_TOKEN;

    console.log(`[OpenClawService] Mode: ${this.mode.toUpperCase()}`);

    if (this.mode === 'http' && !this.verificationToken) {
      throw new Error('OPENCLAW_VERIFICATION_TOKEN required for HTTP mode');
    }
  }

  async sendMessage(
    message: string,
    agentName: string,
    sessionId: string,
    context?: AgentContext,
    deliver?: boolean,
    replyAccount?: string,
    replyTo?: string
  ): Promise<OpenClawResponse> {
    if (this.mode === 'http') {
      return this.sendViaHttp(message, agentName, sessionId, context, deliver, replyAccount, replyTo);
    } else {
      return this.sendViaCli(message, agentName, sessionId, context, deliver, replyAccount, replyTo);
    }
  }

  private async sendViaHttp(...): Promise<OpenClawResponse> {
    // HTTP Gateway API implementation
  }

  private async sendViaCli(...): Promise<OpenClawResponse> {
    // CLI implementation (existing code)
  }
}
```

---

### 2. HTTP Gateway API Endpoint

**New Route**: `POST /api/openclaw/gateway`

```typescript
// server/src/routes/openclaw-gateway.ts
import express from 'express';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

/**
 * OpenClaw Gateway API
 * POST /api/openclaw/gateway
 *
 * Body:
 * {
 *   "message": "text",
 *   "agent": "family-mom",
 *   "sessionId": "family-chat-mom",
 *   "context": { ... },
 *   "deliver": false,
 *   "replyAccount": "family",
 *   "replyTo": "oc_xxx"
 * }
 */
router.post('/gateway', verifyToken, async (req, res) => {
  try {
    const { message, agent, sessionId, context, deliver = false, replyAccount, replyTo } = req.body;

    // Validate required fields
    if (!message || !agent || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: message, agent, sessionId',
      });
    }

    // Call OpenClaw CLI on behalf of caller
    const openClawService = new OpenClawService();
    const response = await openClawService.sendMessage(
      message,
      agent,
      sessionId,
      context,
      deliver,
      replyAccount,
      replyTo
    );

    // Return response
    res.json({
      success: true,
      content: response.content,
      usage: response.usage,
      metadata: {
        agent,
        sessionId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[OpenClaw Gateway] Error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message,
    });
  }
});

export default router;
```

---

### 3. Authentication Middleware

**New File**: `server/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  authenticated?: boolean;
  token?: string;
}

/**
 * Verify OpenClaw verification token
 */
export function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Missing Authorization header',
    });
  }

  // Support: "Bearer <token>" or just "<token>"
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  const expectedToken = process.env.OPENCLAW_VERIFICATION_TOKEN;

  if (!expectedToken) {
    console.warn('[Auth] OPENCLAW_VERIFICATION_TOKEN not configured');
    return res.status(500).json({
      error: 'Server configuration error',
    });
  }

  if (token !== expectedToken) {
    console.warn('[Auth] Invalid token attempt');
    return res.status(403).json({
      error: 'Invalid authentication token',
    });
  }

  // Token valid, proceed
  req.authenticated = true;
  req.token = token;
  next();
}

/**
 * Optional authentication (doesn't block if missing)
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const expectedToken = process.env.OPENCLAW_VERIFICATION_TOKEN;

    if (token === expectedToken) {
      req.authenticated = true;
      req.token = token;
    }
  }

  next();
}
```

---

## Usage Examples

### HTTP Mode (Production)

```bash
# Set environment
export OPENCLAW_MODE=http
export OPENCLAW_GATEWAY_URL=http://localhost:4000
export OPENCLAW_VERIFICATION_TOKEN=4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468

# Call via HTTP
curl -X POST http://localhost:4000/api/openclaw/gateway \
  -H "Authorization: Bearer 4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello family!",
    "agent": "family-mom",
    "sessionId": "family-chat-mom"
  }'

# Response:
{
  "success": true,
  "content": "Hey! 👋 How's everyone doing?",
  "usage": {
    "totalTokens": 150,
    "cost": 0.002
  },
  "metadata": {
    "agent": "family-mom",
    "sessionId": "family-chat-mom",
    "timestamp": "2026-04-02T12:30:00Z"
  }
}
```

### CLI Mode (Development)

```bash
# Set environment (or just don't set OPENCLAW_MODE, defaults to CLI)
export OPENCLAW_MODE=cli

# Call via CLI (internal, no auth needed)
# Agent Hub automatically uses CLI
```

---

## Benefits of Dual Mode

### HTTP Gateway API

**Pros**:

- ✅ Remote deployment (call OpenClaw on different server)
- ✅ Centralized management (one OpenClaw instance, multiple clients)
- ✅ Better monitoring (all requests go through gateway)
- ✅ Load balancing (multiple OpenClaw instances)
- ✅ Rate limiting per client
- ✅ Audit logging

**Cons**:

- ❌ Requires token management
- ❌ Network latency
- ❌ More complex setup

**Best For**: Production, multi-service deployments

---

### CLI Integration

**Pros**:

- ✅ Simple setup (no config)
- ✅ No authentication overhead
- ✅ Fast (local process)
- ✅ No network calls

**Cons**:

- ❌ Local only (can't call remote OpenClaw)
- ❌ No centralized management
- ❌ Harder to monitor/audit

**Best For**: Local development, single-server deployments

---

## Migration Path

### Phase 1: Add HTTP Support (Current Task)

- ✅ Implement `sendViaHttp()` method
- ✅ Create `/api/openclaw/gateway` endpoint
- ✅ Add authentication middleware
- ✅ Add `OPENCLAW_MODE` config
- ✅ Maintain CLI compatibility

### Phase 2: Test Both Modes

- ✅ Test HTTP mode with token
- ✅ Test CLI mode without token
- ✅ Verify identical behavior
- ✅ Performance comparison

### Phase 3: Documentation

- ✅ Update secrets guide (HTTP mode needs token)
- ✅ Add HTTP mode examples
- ✅ Document migration from CLI to HTTP

### Phase 4: Production Deployment

- ✅ Deploy with HTTP mode
- ✅ Configure token in Kubernetes secrets
- ✅ Set up monitoring for gateway endpoint
- ✅ Rate limiting and alerting

---

## Configuration in Kubernetes

### Development (CLI Mode)

```yaml
# values-dev.yaml
config:
  OPENCLAW_MODE: 'cli'
  # No token needed
```

### Production (HTTP Mode)

```yaml
# values-production.yaml
config:
  OPENCLAW_MODE: 'http'
  OPENCLAW_GATEWAY_URL: 'http://openclaw-gateway:4000'

secrets:
  OPENCLAW_VERIFICATION_TOKEN: 'prod-token-xxx'
```

---

## Security Considerations

### Token Management

**Development**:

```bash
# Generate random token
openssl rand -hex 32
```

**Production**:

- Use external secret management (AWS Secrets Manager, etc.)
- Rotate tokens every 90 days
- Different tokens per environment
- Audit token usage

### Rate Limiting

```typescript
// Add rate limiting to gateway endpoint
import rateLimit from 'express-rate-limit';

const gatewayLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests to OpenClaw Gateway',
});

router.post('/gateway', gatewayLimiter, verifyToken, handler);
```

---

## Testing

### Unit Tests

```typescript
// server/src/services/__tests__/OpenClawService.test.ts

describe('OpenClawService', () => {
  describe('HTTP Mode', () => {
    it('should call HTTP endpoint with token', async () => {
      process.env.OPENCLAW_MODE = 'http';
      process.env.OPENCLAW_VERIFICATION_TOKEN = 'test-token';

      const service = new OpenClawService();
      const response = await service.sendMessage('test', 'family-mom', 'test-session');

      expect(response.content).toBeDefined();
    });
  });

  describe('CLI Mode', () => {
    it('should call CLI without token', async () => {
      process.env.OPENCLAW_MODE = 'cli';

      const service = new OpenClawService();
      const response = await service.sendMessage('test', 'family-mom', 'test-session');

      expect(response.content).toBeDefined();
    });
  });
});
```

### Integration Tests

```bash
# Test HTTP mode
curl -X POST http://localhost:4000/api/openclaw/gateway \
  -H "Authorization: Bearer test-token" \
  -d '{"message":"test","agent":"family-mom","sessionId":"test"}'

# Test CLI mode (automatic when mode=cli)
# Trigger via Web UI or API
```

---

## Implementation Checklist

- [ ] Create `server/src/middleware/auth.ts`
- [ ] Update `OpenClawService.ts` with dual mode
- [ ] Create `server/src/routes/openclaw-gateway.ts`
- [ ] Register gateway route in `server/src/index.ts`
- [ ] Update `values.yaml` with new config options
- [ ] Update documentation
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Test both modes end-to-end

---

**Ready to implement?** This gives you the best of both worlds - simple CLI for dev, robust HTTP API for production! 🚀
