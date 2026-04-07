# Secrets Configuration - Required vs Optional Fields

**Quick Reference**: What you MUST configure vs what's optional

---

## Complete Template with Requirements

```yaml
secrets:
  # ============================================
  # REQUIRED - Feishu Integration (All 4 fields)
  # ============================================
  FEISHU_APP_ID: 'cli_xxx' # ✅ REQUIRED
  FEISHU_APP_SECRET: 'xxx' # ✅ REQUIRED
  FEISHU_CHAT_ID: 'oc_xxx' # ✅ REQUIRED
  FEISHU_VERIFY_TOKEN: 'your-token' # ✅ REQUIRED

  # ============================================
  # REQUIRED - OpenClaw Integration
  # ============================================
  OPENCLAW_VERIFICATION_TOKEN: 'xxx' # ✅ REQUIRED

  # ============================================
  # REQUIRED - Security & Encryption (All 3)
  # ============================================
  JWT_SECRET: 'xxx' # ✅ REQUIRED
  ENCRYPTION_KEY: 'xxx' # ✅ REQUIRED
  API_KEY: 'xxx' # ⚠️ OPTIONAL (only if exposing API)

  # ============================================
  # OPTIONAL - Monitoring
  # ============================================
  SENTRY_DSN: 'https://xxx@sentry.io/xxx' # ❌ OPTIONAL
```

---

## Required Fields (Must Configure)

### Feishu Integration (4/4 Required)

| Field                 | Status          | Why Required                  | What Happens If Missing                    |
| --------------------- | --------------- | ----------------------------- | ------------------------------------------ |
| `FEISHU_APP_ID`       | ✅ **REQUIRED** | Identifies your Feishu app    | ❌ Cannot connect to Feishu                |
| `FEISHU_APP_SECRET`   | ✅ **REQUIRED** | Authenticates API calls       | ❌ All Feishu API calls fail               |
| `FEISHU_CHAT_ID`      | ✅ **REQUIRED** | Identifies target group chat  | ❌ Messages sent to wrong chat or fail     |
| `FEISHU_VERIFY_TOKEN` | ✅ **REQUIRED** | Verifies webhook authenticity | ❌ Webhooks rejected, no messages received |

**Minimum for Feishu**: All 4 fields required

---

### OpenClaw Integration (1/1 Required)

| Field                         | Status          | Why Required                      | What Happens If Missing                         |
| ----------------------------- | --------------- | --------------------------------- | ----------------------------------------------- |
| `OPENCLAW_VERIFICATION_TOKEN` | ✅ **REQUIRED** | Authenticates to OpenClaw Gateway | ❌ Cannot call OpenClaw agents, no AI responses |

**Minimum for OpenClaw**: This token required

---

### Security & Encryption (2/3 Required)

| Field            | Status          | Why Required                | What Happens If Missing                                               |
| ---------------- | --------------- | --------------------------- | --------------------------------------------------------------------- |
| `JWT_SECRET`     | ✅ **REQUIRED** | Signs authentication tokens | ❌ Admin dashboard login fails, API auth broken                       |
| `ENCRYPTION_KEY` | ✅ **REQUIRED** | Encrypts sensitive data     | ❌ App crashes on startup (cannot initialize crypto)                  |
| `API_KEY`        | ⚠️ **OPTIONAL** | External API authentication | ✅ App works fine without it (only needed if exposing API externally) |

**Minimum for Security**: JWT_SECRET + ENCRYPTION_KEY required

---

## Optional Fields (Configure as Needed)

### Monitoring (0/1 Required)

| Field        | Status          | Purpose                            | When to Configure                            |
| ------------ | --------------- | ---------------------------------- | -------------------------------------------- |
| `SENTRY_DSN` | ❌ **OPTIONAL** | Error tracking and crash reporting | Configure for production, skip for local dev |

**Benefits of Configuring**:

- See errors in real-time
- Get stack traces
- Track error frequency
- Performance monitoring

**When Optional Is Fine**:

- Local development
- Testing environments
- Small deployments without monitoring needs

---

## Configuration Scenarios

### Scenario 1: Local Development (Minimum)

**Required**: 7 fields

```yaml
secrets:
  # Feishu (if testing Feishu integration)
  FEISHU_APP_ID: 'cli_dev_xxx'
  FEISHU_APP_SECRET: 'dev_secret'
  FEISHU_CHAT_ID: 'oc_dev_xxx'
  FEISHU_VERIFY_TOKEN: 'dev-token'

  # OpenClaw
  OPENCLAW_VERIFICATION_TOKEN: 'xxx'

  # Security
  JWT_SECRET: 'dev-jwt-secret-not-for-production'
  ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000'

  # Optional - Skip for dev
  # API_KEY: (not needed)
  # SENTRY_DSN: (not needed)
```

---

### Scenario 2: Production with Feishu

**Required**: 7 fields + 1 recommended optional

```yaml
secrets:
  # Feishu (production values)
  FEISHU_APP_ID: 'cli_prod_xxx'
  FEISHU_APP_SECRET: 'production-secret'
  FEISHU_CHAT_ID: 'oc_prod_xxx'
  FEISHU_VERIFY_TOKEN: 'prod-verify-token'

  # OpenClaw
  OPENCLAW_VERIFICATION_TOKEN: 'prod-token'

  # Security (use real random keys!)
  JWT_SECRET: 'a1b2c3d4e5f6...' # 32+ chars
  ENCRYPTION_KEY: '0123456789abcdef...' # 64 hex chars
  API_KEY: 'sk_prod_xxx' # If exposing API

  # Recommended for production
  SENTRY_DSN: 'https://prod@sentry.io/123'
```

---

### Scenario 3: Web UI Only (No Feishu)

**Required**: 3 fields (skip Feishu entirely)

```yaml
secrets:
  # Skip Feishu fields entirely

  # OpenClaw
  OPENCLAW_VERIFICATION_TOKEN: 'xxx'

  # Security
  JWT_SECRET: 'xxx'
  ENCRYPTION_KEY: 'xxx'

  # Optional
  API_KEY: 'xxx' # If needed
  SENTRY_DSN: 'xxx' # If needed
```

**Note**: App will work with Web UI only, no Feishu integration

---

## Validation Checklist

### Before Installing Helm Chart

```bash
# ✅ Check all required fields exist
grep -E "FEISHU_APP_ID|FEISHU_APP_SECRET|FEISHU_CHAT_ID|FEISHU_VERIFY_TOKEN|OPENCLAW_VERIFICATION_TOKEN|JWT_SECRET|ENCRYPTION_KEY" secrets.local.yaml

# Should show 7+ lines

# ✅ Verify no empty values
grep -E "= \"\"|= ''" secrets.local.yaml

# Should show NO output (empty values not allowed for required fields)

# ✅ Verify ENCRYPTION_KEY is 64 hex chars
grep "ENCRYPTION_KEY" secrets.local.yaml | awk -F'"' '{print $2}' | wc -c

# Should output: 65 (64 chars + newline)

# ✅ Verify JWT_SECRET is 32+ chars
grep "JWT_SECRET" secrets.local.yaml | awk -F'"' '{print $2}' | wc -c

# Should output: 33+ (32+ chars + newline)
```

---

## Error Messages by Missing Field

| Missing Field                 | Error Message                   | Solution                                  |
| ----------------------------- | ------------------------------- | ----------------------------------------- |
| `FEISHU_APP_ID`               | "Feishu App ID not configured"  | Add FEISHU_APP_ID to secrets              |
| `FEISHU_APP_SECRET`           | "Feishu authentication failed"  | Add FEISHU_APP_SECRET                     |
| `FEISHU_CHAT_ID`              | "Target chat not specified"     | Add FEISHU_CHAT_ID                        |
| `FEISHU_VERIFY_TOKEN`         | "Webhook verification failed"   | Add FEISHU_VERIFY_TOKEN                   |
| `OPENCLAW_VERIFICATION_TOKEN` | "OpenClaw Gateway auth failed"  | Add OPENCLAW_VERIFICATION_TOKEN           |
| `JWT_SECRET`                  | "JWT_SECRET not configured"     | Add JWT_SECRET (min 32 chars)             |
| `ENCRYPTION_KEY`              | "ENCRYPTION_KEY invalid length" | Add ENCRYPTION_KEY (exactly 64 hex chars) |

---

## Quick Reference Table

| Field                         | Required | Format    | Min Length | Default if Missing   |
| ----------------------------- | -------- | --------- | ---------- | -------------------- |
| `FEISHU_APP_ID`               | ✅ Yes   | `cli_xxx` | ~20 chars  | App fails to connect |
| `FEISHU_APP_SECRET`           | ✅ Yes   | Random    | 32 chars   | API calls fail       |
| `FEISHU_CHAT_ID`              | ✅ Yes   | `oc_xxx`  | ~30 chars  | Messages fail        |
| `FEISHU_VERIFY_TOKEN`         | ✅ Yes   | Custom    | 16 chars   | Webhooks rejected    |
| `OPENCLAW_VERIFICATION_TOKEN` | ✅ Yes   | Hex       | 40 chars   | Gateway auth fails   |
| `JWT_SECRET`                  | ✅ Yes   | Custom    | 32 chars   | Auth broken          |
| `ENCRYPTION_KEY`              | ✅ Yes   | Hex       | 64 chars   | **App crashes**      |
| `API_KEY`                     | ⚠️ No    | Custom    | 32 chars   | None (not needed)    |
| `SENTRY_DSN`                  | ❌ No    | URL       | Variable   | No error tracking    |

---

## Summary

### Must Configure (7 fields):

1. ✅ `FEISHU_APP_ID`
2. ✅ `FEISHU_APP_SECRET`
3. ✅ `FEISHU_CHAT_ID`
4. ✅ `FEISHU_VERIFY_TOKEN`
5. ✅ `OPENCLAW_VERIFICATION_TOKEN`
6. ✅ `JWT_SECRET`
7. ✅ `ENCRYPTION_KEY`

### Optional (2 fields):

1. ⚠️ `API_KEY` - Only if exposing API externally
2. ❌ `SENTRY_DSN` - Only if you want error tracking

**Total**: 7 required + 2 optional = 9 fields

---

**Ready to configure?** Start with the 7 required fields, then add optional ones as needed! 🚀
