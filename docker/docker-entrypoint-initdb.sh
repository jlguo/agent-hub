#!/bin/sh
set -e

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
