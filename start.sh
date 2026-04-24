#!/bin/bash

# Agent Hub Startup Script
# Starts both backend and frontend servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔════════════════════════════════════════════════╗"
echo "║          Agent Hub - Starting Servers          ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check if node modules are installed
if [ ! -d "node_modules" ]; then
  echo "⚠️  Installing dependencies..."
  npm install
fi

if [ ! -d "client/node_modules" ]; then
  echo "⚠️  Installing client dependencies..."
  cd client && npm install && cd ..
fi

# Kill any existing processes on ports 4000 and 3000
echo "🔍 Checking for existing processes..."
for port in 4000 3000; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "⚠️  Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  fi
done

echo ""
echo "🚀 Starting Backend (port 4000)..."
echo "🚀 Starting Frontend (port 3000)..."
echo ""

# Seed database (idempotent - uses upsert)
echo "🌱 Seeding database..."
DATABASE_URL="file:./prisma/dev.db" npx tsx prisma/seed.ts 2>/dev/null || echo "⚠️  Seed completed with warnings (non-critical)"

# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  sleep 1
done

# Start frontend in background
cd client && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║           Agent Hub - Servers Started          ║"
echo "╠════════════════════════════════════════════════╣"
echo "║  Backend:  http://localhost:4000               ║"
echo "║  Frontend: http://localhost:3000               ║"
echo "║  Health:   http://localhost:4000/health        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait
