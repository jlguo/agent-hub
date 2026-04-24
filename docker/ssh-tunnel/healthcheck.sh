#!/bin/bash
# Health check for SSH tunnel container
# Checks if port 18789 is listening (SSH tunnel active)

set -e

echo "Checking SSH tunnel health..."

# Check if port 18789 is listening
if nc -z localhost 18789 2>/dev/null; then
    echo "✅ SSH tunnel healthy - port 18789 listening"
    exit 0
else
    echo "❌ SSH tunnel unhealthy - port 18789 not listening"
    echo ""
    echo "Possible causes:"
    echo "  1. SSH connection failed"
    echo "  2. Remote host unreachable"
    echo "  3. SSH key authentication failed"
    echo "  4. Remote OpenClaw Gateway not running"
    echo ""
    echo "Check logs: docker-compose logs ssh-tunnel"
    exit 1
fi
