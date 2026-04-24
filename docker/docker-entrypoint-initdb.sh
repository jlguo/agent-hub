#!/bin/sh
set -e

echo "🔐 Starting SSH tunnel for OpenClaw remote mode..."

# Fix SSH key permissions if mounted from volume
if [ -d /home/nodeuser/.ssh ] && [ "$(ls -A /home/nodeuser/.ssh 2>/dev/null)" ]; then
  echo "🔑 Fixing SSH key permissions..."
  chmod 700 /home/nodeuser/.ssh 2>/dev/null || true
  chmod 600 /home/nodeuser/.ssh/id_ed25519 2>/dev/null || true
  chmod 644 /home/nodeuser/.ssh/id_ed25519.pub 2>/dev/null || true
  chown -R nodeuser:nodejs /home/nodeuser/.ssh 2>/dev/null || true
  echo "✅ SSH key permissions fixed"
fi

# Start SSH tunnel if OPENCLAW_MODE is remote
if [ "$OPENCLAW_MODE" = "remote" ]; then
  # Kill any existing tunnel
  pkill -f 'ssh.*-L.*18789' 2>/dev/null || true
  
  # Start persistent SSH tunnel with auto-reconnect
  ssh -f -N \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ExitOnForwardFailure=yes \
    -i /home/nodeuser/.ssh/id_ed25519 \
    -L 18789:127.0.0.1:18789 \
    root@host.docker.internal 2>&1 || echo "⚠️  SSH tunnel startup warning (may already be running)"
  
  # Wait for tunnel to establish
  sleep 3
  
  # Verify tunnel
  if pgrep -f "ssh.*-L.*18789" > /dev/null; then
    echo "✅ SSH tunnel started (PID: $(pgrep -f 'ssh.*-L.*18789'))"
  else
    echo "⚠️  SSH tunnel may not have started, continuing anyway..."
  fi
fi

# Initialize database if empty or doesn't have tables
if [ ! -f /app/prisma/dev.db ] || [ ! -s /app/prisma/dev.db ]; then
  echo "📦 Database file missing or empty, initializing..."
  initialize_db=true
else
  # Check if database has tables by trying to query
  echo "🔍 Checking if database has tables..."
  if ! cd /app && npx prisma db pull --schema=/app/server/prisma/schema.prisma 2>&1 | grep -q "Introspecting"; then
    echo "📦 Database exists but has no tables, initializing..."
    initialize_db=true
  else
    echo "✅ Database already initialized"
    initialize_db=false
  fi
fi

if [ "$initialize_db" = true ]; then
  # Use schema from server directory (not hidden by volume mount)
  SCHEMA_PATH="/app/server/prisma/schema.prisma"
  
  if [ -f "$SCHEMA_PATH" ]; then
    echo "✅ Found schema at $SCHEMA_PATH"
    cd /app && npx prisma db push --schema="$SCHEMA_PATH" --accept-data-loss
    echo "✅ Database initialized!"
  else
    echo "❌ Schema not found at $SCHEMA_PATH"
    echo "Looking for schema..."
    find /app -name "schema.prisma" 2>/dev/null || true
    exit 1
  fi
fi

# Start the application
exec npm run dev
