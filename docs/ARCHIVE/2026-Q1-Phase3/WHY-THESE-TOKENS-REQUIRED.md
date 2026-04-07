# Why These Tokens Are Required

**Understanding the security model behind `OPENCLAW_VERIFICATION_TOKEN` and `FEISHU_VERIFY_TOKEN`**

---

## 1. OPENCLAW_VERIFICATION_TOKEN

### What Problem Does It Solve?

**Problem**: Anyone could call your OpenClaw Gateway and:

- Use your configured AI agents
- Send messages through your Feishu bot
- Consume your API quotas
- Impersonate your application

**Solution**: Token-based authentication proves "I am Agent Hub, let me talk to OpenClaw"

---

### How It Works

```
┌─────────────┐                    ┌──────────────────┐
│  Agent Hub  │                    │ OpenClaw Gateway │
│             │                    │                  │
│ 1. Include  │───────────────────>│ 2. Verify token  │
│    token in │   API Request      │    matches       │
│    request  │                    │    config        │
│             │                    │                  │
│ 3. Get      │<───────────────────│ 4. Token valid?  │
│    response │   AI Response      │    ✅ Yes → OK   │
│             │                    │    ❌ No → 401   │
└─────────────┘                    └──────────────────┘
```

### Request Example

```bash
# With token (works ✅)
curl -H "Authorization: Bearer 4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468" \
  http://localhost:4000/api/agent \
  -d '{"message": "hello"}'

# Without token (fails ❌)
curl http://localhost:4000/api/agent \
  -d '{"message": "hello"}'
# Response: 401 Unauthorized
```

### Where It's Used in Code

```typescript
// server/src/services/OpenClawService.ts
async sendMessage(agentId: string, message: string) {
  const token = process.env.OPENCLAW_VERIFICATION_TOKEN;

  const command = `openclaw agent --session-id ${agentId} --message "${message}" --token ${token}`;

  // Without token, OpenClaw CLI rejects the request
  const { stdout } = await exec(command);
  return stdout;
}
```

### What Happens Without It?

```
❌ OpenClaw CLI Error:
"Authentication required. Please provide a valid token."

❌ HTTP 401 Error:
"Unauthorized: Missing or invalid authentication token"
```

### Why It's Required

1. **Prevents unauthorized access** - Only Agent Hub can use your OpenClaw Gateway
2. **Protects your agents** - Others can't call your AI models
3. **Audit trail** - OpenClaw logs which token made each request
4. **Rate limiting** - OpenClaw can apply limits per token

---

## 2. FEISHU_VERIFY_TOKEN

### What Problem Does It Solve?

**Problem**: Anyone could send fake webhooks to your Agent Hub and:

- Trigger agent responses spam
- Inject malicious messages
- Flood your database with fake data
- Disrupt your family chat

**Solution**: Token-based webhook verification proves "This webhook is from Feishu, not an attacker"

---

### How It Works

```
┌──────────────┐                    ┌─────────────┐
│   Feishu     │                    │  Agent Hub  │
│   Platform   │                    │  Webhook    │
│              │                    │  Endpoint   │
│ 1. Send      │                    │             │
│    webhook   │───────────────────>│ 2. Check    │
│    + sign    │  HTTP POST         │    signature│
│              │                    │    using     │
│              │                    │    token     │
│              │                    │             │
│ 3. OK       │<───────────────────│ 3. Valid?   │
│    process   │  200 OK            │ ✅ Yes      │
│              │                    │ ❌ No → 403 │
└──────────────┘                    └─────────────┘
```

### Verification Flow

**Step 1**: You set token in Feishu Open Platform

```
Feishu Open Platform → Event Subscriptions → Settings
Verify Token: "agent-hub-verify-token"
```

**Step 2**: Feishu sends webhook with signature

```http
POST /api/webhooks/feishu
Content-Type: application/json

{
  "challenge": "xxx",
  "type": "url_verification",
  "token": "agent-hub-verify-token"  // ← Your token
}
```

**Step 3**: Agent Hub verifies signature

```typescript
// server/src/routes/webhooks.ts
app.post('/api/webhooks/feishu', (req, res) => {
  const { token } = req.body;
  const expectedToken = process.env.FEISHU_VERIFY_TOKEN;

  if (token !== expectedToken) {
    // ❌ Reject fake webhooks
    return res.status(403).json({ error: 'Invalid token' });
  }

  // ✅ Process real Feishu webhooks
  handleMessage(req.body);
  res.status(200).json({ challenge: req.body.challenge });
});
```

### Attack Scenario (Without Token)

```
👹 Attacker sends fake webhook:

curl -X POST http://your-server.com/api/webhooks/feishu \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "content": "SPAM MESSAGE",
      "sender": {"id": "fake-user"}
    }
  }'

❌ Without token verification:
→ Message processed as real Feishu message
→ Agent responds to spam
→ Database polluted with fake data

✅ With token verification:
curl: ... -d '{"token": "wrong-token"}'
→ 403 Forbidden
→ Webhook rejected
→ No spam processed
```

### Why It's Required

1. **Prevents webhook spoofing** - Only Feishu can send webhooks
2. **Stops spam attacks** - Attackers can't flood your system
3. **Ensures message authenticity** - Messages are really from Feishu
4. **Required by Feishu** - Feishu won't enable webhooks without it

---

## Key Differences

| Aspect               | OPENCLAW_VERIFICATION_TOKEN                   | FEISHU_VERIFY_TOKEN                |
| -------------------- | --------------------------------------------- | ---------------------------------- |
| **Direction**        | Outbound (Agent Hub → OpenClaw)               | Inbound (Feishu → Agent Hub)       |
| **Purpose**          | Authenticate API requests                     | Verify webhook authenticity        |
| **Format**           | 40-char hex string                            | Any string (you choose)            |
| **Who Provides**     | OpenClaw config (`~/.openclaw/openclaw.json`) | You create it (set in both places) |
| **Where Used**       | OpenClaw CLI commands                         | Feishu webhook handler             |
| **Attack Prevented** | Unauthorized API usage                        | Fake webhook injection             |

---

## Analogy: Physical Security

### OPENCLAW_VERIFICATION_TOKEN

Like a **key card** to enter a building:

```
You (Agent Hub) → Show key card (token) → Security (OpenClaw) → Access granted ✅
Stranger → No key card → Security → Access denied ❌
```

### FEISHU_VERIFY_TOKEN

Like a **secret handshake** to verify identity:

```
Feishu → Does secret handshake (token) → You (Agent Hub) → "It's really Feishu!" ✅
Attacker → Wrong handshake → You → "Imposter!" ❌
```

---

## Where to Get/Set Each Token

### OPENCLAW_VERIFICATION_TOKEN

**Source**: OpenClaw configuration file

```bash
# View your token
cat ~/.openclaw/openclaw.json | grep -A 5 "gateway"

# Output:
# "gateway": {
#   "mode": "local",
#   "auth": {
#     "mode": "token",
#     "token": "4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468"
#   }
# }
```

**You don't create this** - OpenClaw generates it. You just copy it to your secrets.

---

### FEISHU_VERIFY_TOKEN

**Source**: You create it!

**Step 1**: Choose any string (recommend 16+ characters)

```bash
# Option 1: Simple
agent-hub-verify-token

# Option 2: Random
openssl rand -hex 16
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Option 3: UUID
uuidgen | tr -d '-'
# Output: a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
```

**Step 2**: Set in Feishu Open Platform

1. Go to https://open.feishu.cn/
2. Your App → Event Subscriptions → Settings
3. Enter token: `agent-hub-verify-token`
4. Save

**Step 3**: Set in secrets.local.yaml

```yaml
secrets:
  FEISHU_VERIFY_TOKEN: 'agent-hub-verify-token' # Must match!
```

**Critical**: Token must match in BOTH places!

---

## What If I'm Only Using Web UI (No Feishu)?

### OPENCLAW_VERIFICATION_TOKEN

**Still Required** ✅

- You're still using OpenClaw agents for AI responses
- Token authenticates Agent Hub to OpenClaw

### FEISHU_VERIFY_TOKEN

**Optional** ❌

- If not using Feishu, no webhooks to verify
- You can skip this field entirely

```yaml
# Web UI only config
secrets:
  # Skip Feishu fields
  # FEISHU_APP_ID: (not needed)
  # FEISHU_APP_SECRET: (not needed)
  # FEISHU_CHAT_ID: (not needed)
  # FEISHU_VERIFY_TOKEN: (not needed) ← Skip!

  # Still need OpenClaw
  OPENCLAW_VERIFICATION_TOKEN: "xxx" ✅

  # Security
  JWT_SECRET: "xxx" ✅
  ENCRYPTION_KEY: "xxx" ✅
```

---

## What If I'm Using Both Feishu + Web UI?

**Both tokens required** ✅

```yaml
secrets:
  # Feishu (all 4 fields)
  FEISHU_APP_ID: "cli_xxx" ✅
  FEISHU_APP_SECRET: "xxx" ✅
  FEISHU_CHAT_ID: "oc_xxx" ✅
  FEISHU_VERIFY_TOKEN: "xxx" ✅ ← Required!

  # OpenClaw
  OPENCLAW_VERIFICATION_TOKEN: "xxx" ✅ ← Required!

  # Security
  JWT_SECRET: "xxx" ✅
  ENCRYPTION_KEY: "xxx" ✅
```

---

## Summary

### Why OPENCLAW_VERIFICATION_TOKEN is Required

1. ✅ Authenticates Agent Hub to OpenClaw Gateway
2. ✅ Prevents unauthorized API usage
3. ✅ Protects your AI agents from abuse
4. ✅ Required by OpenClaw CLI

**Without it**: All OpenClaw API calls fail with 401 Unauthorized

---

### Why FEISHU_VERIFY_TOKEN is Required (if using Feishu)

1. ✅ Verifies webhooks are really from Feishu
2. ✅ Prevents fake webhook attacks
3. ✅ Stops spam and injection
4. ✅ Required by Feishu to enable webhooks

**Without it**: Webhooks rejected, can't receive Feishu messages

---

### When Can You Skip FEISHU_VERIFY_TOKEN?

✅ **Web UI only deployment** (no Feishu integration)
❌ **Feishu integration** (required for webhook verification)

---

**Bottom Line**: These tokens are your security boundary. They prove "I am who I say I am" in both directions (outbound to OpenClaw, inbound from Feishu). 🚀
