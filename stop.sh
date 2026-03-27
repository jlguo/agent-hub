#!/bin/bash

# Agent Hub Stop Script
# Stops both backend and frontend servers

echo "╔════════════════════════════════════════════════╗"
echo "║          Agent Hub - Stopping Servers          ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

for port in 4000 3000; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "✅ Stopping server on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  else
    echo "ℹ️  No process on port $port"
  fi
done

echo ""
echo "✅ All servers stopped"
