# Docker SQLite Permission Issue - Fix Guide

## Problem

```
Failed to send message: {"error":"\nInvalid `prisma.message.create()` invocation:\n\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(SqliteError { extended_code: 8, message: Some(\"attempt to write a readonly database\") }), transient: false })"}
```

**Root Cause:** Docker container runs as non-root user (`nodeuser`), but SQLite database file is owned by root.

---

## Solution 1: Fix Dockerfile (Recommended)

### Updated Dockerfile.backend

```dockerfile
# After creating non-root user and copying files
RUN mkdir -p /app/prisma && \
    chown -R nodeuser:nodejs /app/prisma && \
    chmod 755 /app/prisma

# Initialize database with correct permissions
RUN touch /app/prisma/dev.db && \
    chown nodeuser:nodejs /app/prisma/dev.db && \
    chmod 664 /app/prisma/dev.db || true

USER nodeuser
WORKDIR /app
```

### Rebuild and Test

```bash
# Stop existing containers
docker-compose down -v

# Rebuild backend with permission fix
docker-compose build --no-cache backend

# Start fresh
docker-compose up -d

# Check database permissions
docker-compose exec backend ls -la /app/prisma/

# Expected output:
# drwxr-xr-x  2 nodeuser nodejs 4096 Apr  3 09:00 .
# -rw-rw-r--  1 nodeuser nodejs 544768 Apr  3 09:00 dev.db
```

---

## Solution 2: Fix docker-compose.yml (Alternative)

### Add User Configuration

```yaml
services:
  backend:
    # ... existing config ...
    user: '1001:1001' # Match nodeuser UID:GID
    volumes:
      - backend-data:/app/prisma
```

### Initialize Volume Permissions

Create `scripts/init-docker-db.sh`:

```bash
#!/bin/bash
docker-compose exec backend chown -R nodeuser:nodejs /app/prisma
docker-compose exec backend chmod 755 /app/prisma
docker-compose exec backend chmod 664 /app/prisma/dev.db
```

Run after starting containers:

```bash
docker-compose up -d
./scripts/init-docker-db.sh
```

---

## Solution 3: Use Named Volume with Correct Permissions

### Update docker-compose.yml

```yaml
volumes:
  backend-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /tmp/agent-hub-data # Host path with correct permissions
```

### Set Host Permissions

```bash
# Create host directory
mkdir -p /tmp/agent-hub-data
chmod 777 /tmp/agent-hub-data

# Start containers
docker-compose up -d
```

---

## Verification Steps

### 1. Check Container User

```bash
docker-compose exec backend whoami
# Expected: nodeuser

docker-compose exec backend id
# Expected: uid=1001(nodeuser) gid=1001(nodejs)
```

### 2. Check Database Permissions

```bash
docker-compose exec backend ls -la /app/prisma/
# Expected:
# drwxr-xr-x  2 nodeuser nodejs 4096 ...
# -rw-rw-r--  1 nodeuser nodejs 544768 ... dev.db
```

### 3. Test Database Write

```bash
docker-compose exec backend npx prisma db pull
# Should succeed without "readonly database" error
```

### 4. Check Application Logs

```bash
docker-compose logs backend | grep -i "error"
# Should show no SQLite permission errors
```

---

## Common Mistakes

### ❌ Wrong: Volume mounted after USER directive

```dockerfile
USER nodeuser
VOLUME /app/prisma  # Created as root!
```

### ✅ Correct: Set permissions before USER

```dockerfile
RUN mkdir -p /app/prisma && chown nodeuser:nodejs /app/prisma
USER nodeuser
```

### ❌ Wrong: Using root user

```dockerfile
USER root  # Security risk!
```

### ✅ Correct: Non-root user with permissions

```dockerfile
RUN adduser --system --uid 1001 nodeuser
RUN chown -R nodeuser:nodejs /app
USER nodeuser
```

---

## Quick Fix for Existing Containers

If containers are already running with this issue:

```bash
# Stop containers
docker-compose down

# Remove volume (data will be lost!)
docker volume rm agent-hub_backend-data

# Or fix permissions on existing volume
docker run --rm -v agent-hub_backend-data:/app/prisma alpine \
  chown -R 1001:1001 /app/prisma

# Rebuild with fixed Dockerfile
docker-compose build --no-cache backend

# Start fresh
docker-compose up -d
```

---

## Prevention

### Add Health Check for Database Write

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

# Add custom health check script
COPY healthcheck.sh /healthcheck.sh
RUN chmod +x /healthcheck.sh
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD /healthcheck.sh || exit 1
```

### healthcheck.sh

```bash
#!/bin/sh
set -e

# Check HTTP health
wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

# Check database write permissions
test -w /app/prisma/dev.db || exit 1

exit 0
```

---

## Summary

**Best Practice:** Set database directory and file permissions in Dockerfile BEFORE switching to non-root user.

**Quick Fix:** Rebuild with updated Dockerfile + remove old volume.

**Verification:** Check permissions with `docker-compose exec backend ls -la /app/prisma/`

---

## Related Files

- `Dockerfile.backend` - Backend container definition
- `docker-compose.yml` - Volume configuration
- `prisma/schema.prisma` - Database schema
- `prisma/dev.db` - SQLite database file

---

**Last Updated:** 2026-04-03  
**Status:** Fix applied to Dockerfile.backend, awaiting rebuild
