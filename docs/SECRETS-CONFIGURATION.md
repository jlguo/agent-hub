# Secrets Configuration Guide

**File**: `k8s/helm/agent-hub/secrets.local.yaml`  
**Purpose**: Sensitive credentials and API keys for Agent Hub  
**Security**: ⚠️ **DO NOT COMMIT** this file to Git (already in .gitignore)

---

## Complete Secrets Template

```yaml
secrets:
  # Feishu Integration
  FEISHU_APP_ID: "cli_a930b22377b9dcd6"
  FEISHU_APP_SECRET: "CbnapLyCprizpwj0DC4RZkpSGb1HFiMR"
  FEISHU_CHAT_ID: "oc_ca9b129b5264ac7b79a569d0dd0b1022"
  FEISHU_VERIFY_TOKEN: "agent-hub-verify-token"
  
  # OpenClaw Integration
  OPENCLAW_VERIFICATION_TOKEN: "4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468"
  
  # Security & Encryption
  JWT_SECRET: "your-super-secret-jwt-key-min-32-characters-long"
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  API_KEY: "your-api-key-for-external-services"
  
  # Monitoring (Optional)
  SENTRY_DSN: "https://xxx@sentry.io/xxx"
```

---

## Field-by-Field Explanation

### 1. Feishu Integration

#### `FEISHU_APP_ID`
- **Format**: `cli_xxx` (starts with "cli_")
- **Purpose**: Identifies your Feishu/Lark application
- **Where to Get**: 
  1. Go to [Feishu Open Platform](https://open.feishu.cn/)
  2. Create an enterprise/internal app
  3. Find "App ID" in Basic Information
- **Example**: `cli_a930b22377b9dcd6`
- **Required**: ✅ Yes (for Feishu integration)
- **Security**: 🔒 Low (public identifier, but keep private)

---

#### `FEISHU_APP_SECRET`
- **Format**: Random string (32-64 characters)
- **Purpose**: Authenticates API requests to Feishu
- **Where to Get**:
  1. Feishu Open Platform → Your App
  2. App Credentials section
  3. Click "View" or "Reset" to get secret
- **Example**: `CbnapLyCprizpwj0DC4RZkpSGb1HFiMR`
- **Required**: ✅ Yes (for Feishu integration)
- **Security**: 🔒🔒🔒 **CRITICAL** - Never share or commit!

**What Happens If Leaked**:
- Attacker can impersonate your app
- Access to Feishu API on your behalf
- Can read/send messages in your group chats

**If Compromised**: Immediately reset in Feishu Open Platform

---

#### `FEISHU_CHAT_ID`
- **Format**: `oc_xxx` (starts with "oc_")
- **Purpose**: Identifies the specific Feishu group chat
- **Where to Get**:
  1. Add bot to your Feishu group chat
  2. Send a message in the group
  3. Check bot logs or webhook payload for `chat_id`
  4. Or use Feishu API: `GET /open-apis/im/v1/chats`
- **Example**: `oc_ca9b129b5264ac7b79a569d0dd0b1022`
- **Required**: ✅ Yes (for Feishu integration)
- **Security**: 🔒 Medium (identifies your group, keep private)

**Note**: Each group chat has a unique ID. If you switch groups, update this value.

---

#### `FEISHU_VERIFY_TOKEN`
- **Format**: Any string you choose (recommend 16+ characters)
- **Purpose**: Verifies webhook authenticity from Feishu
- **Where to Set**:
  1. Feishu Open Platform → Your App
  2. Event Subscriptions → Settings
  3. Enter your token (e.g., "agent-hub-verify-token")
  4. Save and verify
- **Example**: `agent-hub-verify-token` or `my-custom-token-123`
- **Required**: ✅ Yes (for webhook verification)
- **Security**: 🔒🔒 Medium-High (prevents fake webhooks)

**How It Works**:
```
Feishu → Sends webhook with signature
Agent Hub → Verifies signature using this token
If match → Process webhook
If no match → Reject (possible attack)
```

---

### 2. OpenClaw Integration

#### `OPENCLAW_VERIFICATION_TOKEN`
- **Format**: Hex string (40 characters)
- **Purpose**: Authenticates requests to OpenClaw Gateway
- **Where to Get**:
  1. OpenClaw configuration file
  2. Location: `~/.openclaw/openclaw.json`
  3. Look for: `gateway.auth.token`
- **Example**: `4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468`
- **Required**: ✅ Yes (for OpenClaw integration)
- **Security**: 🔒🔒🔒 **CRITICAL** - Gateway access token

**How to Find**:
```bash
# View your OpenClaw config
cat ~/.openclaw/openclaw.json | grep -A 5 "gateway"

# Output should show:
# "gateway": {
#   "mode": "local",
#   "auth": { "mode": "token", "token": "4c865174de200c8e808a9dfdc6a0cbc4c76d7eea9ab77468" }
# }
```

**What Happens If Leaked**:
- Attacker can use your OpenClaw Gateway
- Access to all configured agents
- Can send messages through your Feishu bot

---

### 3. Security & Encryption

#### `JWT_SECRET`
- **Format**: Any string (minimum 32 characters recommended)
- **Purpose**: Signs and verifies JWT tokens for authentication
- **How to Generate**:
  ```bash
  # Option 1: Random string
  openssl rand -hex 32
  
  # Option 2: UUID-based
  uuidgen | tr -d '-'
  
  # Option 3: Use password generator
  # https://1password.com/password-generator/
  ```
- **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`
- **Required**: ✅ Yes (for admin dashboard authentication)
- **Security**: 🔒🔒🔒 **CRITICAL** - Authentication security

**What It's Used For**:
- Admin dashboard login sessions
- API authentication tokens
- Session cookies

**Best Practices**:
- Minimum 32 characters
- Mix of letters, numbers, symbols
- Different for each environment (dev/staging/prod)
- Rotate every 90 days in production

---

#### `ENCRYPTION_KEY`
- **Format**: 64-character hex string (32 bytes = 256 bits)
- **Purpose**: AES-256-GCM encryption for sensitive data
- **How to Generate**:
  ```bash
  # Generate 32-byte hex key (64 characters)
  openssl rand -hex 32
  
  # Example output:
  # 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  ```
- **Example**: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
- **Required**: ✅ Yes (for data encryption)
- **Security**: 🔒🔒🔒 **CRITICAL** - Data encryption key

**What It Encrypts**:
- Feishu access tokens (if stored)
- API keys
- User tokens
- Any sensitive metadata

**Important**:
- Exactly 64 hex characters (256 bits)
- AES-256 requires 32 bytes = 64 hex chars
- If lost, encrypted data cannot be recovered
- Never commit to Git!

---

#### `API_KEY`
- **Format**: Any string (recommend 32+ characters)
- **Purpose**: External service authentication
- **How to Generate**:
  ```bash
  # Generate random API key
  openssl rand -base64 32
  
  # Or use UUID
  uuidgen
  ```
// Example removed to comply with GitHub push protection
- **Required**: ⚠️ Optional (only if exposing API externally)
- **Security**: 🔒🔒 High (API access control)

**Use Cases**:
- External services calling Agent Hub API
- Third-party integrations
- Admin API access
- Webhook authentication

**When Not Needed**:
- Local development without external access
- Internal-only deployments
- All authentication via JWT

---

### 4. Monitoring (Optional)

#### `SENTRY_DSN`
- **Format**: `https://xxx@sentry.io/xxx` (URL format)
- **Purpose**: Error tracking and crash reporting
- **Where to Get**:
  1. Create account at [Sentry.io](https://sentry.io/)
  2. Create new project (Node.js)
  3. Copy DSN from Project Settings → Client Keys
- **Example**: `https://abc123def456@sentry.io/1234567`
- **Required**: ❌ Optional (recommended for production)
- **Security**: 🔒 Low (public DSN, but keep private)

**What It Does**:
- Captures uncaught exceptions
- Tracks error frequency
- Provides stack traces
- Alerts on critical errors
- Performance monitoring

**Free Tier**:
- 5,000 errors/month
- 10,000 transactions/month
- 30-day data retention

**How to Set Up**:
```bash
# 1. Sign up at sentry.io
# 2. Create Node.js project
# 3. Copy DSN
# 4. Add to secrets.local.yaml
```

---

## Environment-Specific Values

### Development (secrets.local.yaml)
```yaml
secrets:
  FEISHU_APP_ID: "cli_dev_xxx"
  FEISHU_APP_SECRET: "dev_secret"
  JWT_SECRET: "dev-jwt-secret-not-for-production"
  ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000"  # All zeros for dev only!
  SENTRY_DSN: ""  # Disable in dev
```

### Production (secrets.production.yaml)
```yaml
secrets:
  FEISHU_APP_ID: "cli_prod_xxx"
  FEISHU_APP_SECRET: "production-grade-secret-xyz"
  JWT_SECRET: "production-jwt-secret-32-chars-min"
  ENCRYPTION_KEY: "a1b2c3d4e5f6..."  # Real random key
  SENTRY_DSN: "https://prod@sentry.io/123"
```

**Best Practice**: Use different secrets for each environment!

---

## Security Best Practices

### 1. File Permissions
```bash
# Restrict file access (Unix/Mac)
chmod 600 k8s/helm/agent-hub/secrets.local.yaml

# Only you can read/write
ls -la k8s/helm/agent-hub/secrets.local.yaml
# Should show: -rw-------
```

### 2. Git Safety
```bash
# Verify .gitignore includes secrets
cat k8s/helm/agent-hub/.gitignore
# Should contain: *.local.yaml

# Check if accidentally staged
git status
# secrets.local.yaml should NOT appear
```

### 3. Secret Rotation
```bash
# Rotate secrets every 90 days (production)
# 1. Generate new secret
# 2. Update in Kubernetes
kubectl create secret generic agent-hub-secrets \
  --from-literal=JWT_SECRET="new-secret" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Restart pods to pick up changes
kubectl rollout restart deployment/backend -n agent-hub-prod
```

### 4. Encryption at Rest
```bash
# For production, use external secret management:

# AWS: Secrets Manager + External Secrets Operator
# GCP: Secret Manager + Workload Identity
# Azure: Key Vault + AKV Integration
# HashiCorp: Vault + Vault Injector
```

---

## Troubleshooting

### "Invalid Feishu credentials"
```bash
# Check FEISHU_APP_ID format (should start with "cli_")
# Check FEISHU_APP_SECRET (copy-paste carefully, no extra spaces)
# Verify app has required permissions in Feishu Open Platform
```

### "OpenClaw authentication failed"
```bash
# Verify token matches ~/.openclaw/openclaw.json
cat ~/.openclaw/openclaw.json | grep token

# Test OpenClaw CLI directly
openclaw agent --message "test" --agent "family-mom"
```

### "JWT token invalid"
```bash
# Check JWT_SECRET is minimum 32 characters
echo -n "your-jwt-secret" | wc -c

# Regenerate if needed
openssl rand -hex 32
```

### "Encryption failed"
```bash
# Verify ENCRYPTION_KEY is exactly 64 hex characters
echo -n "your-encryption-key" | wc -c
# Should output: 64

# Must be valid hex (0-9, a-f)
echo "your-encryption-key" | grep -E '^[0-9a-f]{64}$'
```

---

## Quick Reference

| Field | Format | Length | Required | Critical |
|-------|--------|--------|----------|----------|
| `FEISHU_APP_ID` | `cli_xxx` | ~20 chars | ✅ | 🔒 |
| `FEISHU_APP_SECRET` | Random | 32-64 chars | ✅ | 🔒🔒🔒 |
| `FEISHU_CHAT_ID` | `oc_xxx` | ~30 chars | ✅ | 🔒 |
| `FEISHU_VERIFY_TOKEN` | Custom | 16+ chars | ✅ | 🔒🔒 |
| `OPENCLAW_VERIFICATION_TOKEN` | Hex | 40 chars | ✅ | 🔒🔒🔒 |
| `JWT_SECRET` | Custom | 32+ chars | ✅ | 🔒🔒🔒 |
| `ENCRYPTION_KEY` | Hex | 64 chars | ✅ | 🔒🔒🔒 |
| `API_KEY` | Custom | 32+ chars | ⚠️ | 🔒🔒 |
| `SENTRY_DSN` | URL | Variable | ❌ | 🔒 |

---

## Next Steps

1. ✅ **Copy the template** from the top of this document
2. ✅ **Fill in your actual values** (get from Feishu/OpenClaw)
3. ✅ **Save as** `k8s/helm/agent-hub/secrets.local.yaml`
4. ✅ **Set permissions**: `chmod 600 secrets.local.yaml`
5. ✅ **Verify .gitignore**: `cat .gitignore`
6. ✅ **Install Helm chart**: `helm install agent-hub-dev ...`

Need help getting any of these values? Let me know which one! 🚀
