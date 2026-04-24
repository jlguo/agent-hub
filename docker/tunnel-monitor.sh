#!/bin/sh
# SSH Tunnel Monitor for Production
# Restarts tunnel if connection drops

TUNNEL_PORT=18789
SSH_USER=root
SSH_HOST=host.docker.internal
SSH_KEY=/home/nodeuser/.ssh/id_ed25519
LOG_FILE=/var/log/tunnel-monitor.log

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

check_tunnel() {
  # Check if SSH process is running
  if ! pgrep -f "ssh.*-L.*${TUNNEL_PORT}" > /dev/null; then
    return 1
  fi
  
  # Check if port is listening
  if ! netstat -tlnp 2>/dev/null | grep -q ":${TUNNEL_PORT}"; then
    return 1
  fi
  
  return 0
}

start_tunnel() {
  log "Starting SSH tunnel..."
  
  # Kill any stale tunnels
  pkill -f "ssh.*-L.*${TUNNEL_PORT}" 2>/dev/null || true
  
  # Start new tunnel with auto-reconnect
  ssh -f -N \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ExitOnForwardFailure=yes \
    -i ${SSH_KEY} \
    -L ${TUNNEL_PORT}:127.0.0.1:${TUNNEL_PORT} \
    ${SSH_USER}@${SSH_HOST} 2>&1
  
  if [ $? -eq 0 ]; then
    log "✅ Tunnel started successfully"
  else
    log "❌ Failed to start tunnel"
    return 1
  fi
}

# Main loop
log "=== Tunnel Monitor Started ==="

while true; do
  if ! check_tunnel; then
    log "⚠️  Tunnel down, restarting..."
    start_tunnel
    sleep 5
    
    # Verify restart succeeded
    if ! check_tunnel; then
      log "❌ Tunnel restart failed, will retry in 30s"
    else
      log "✅ Tunnel restarted successfully"
    fi
  fi
  
  sleep 30
done
