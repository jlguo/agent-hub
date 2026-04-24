# SSH Tunnel Sidecar for OpenClaw Remote Gateway
# Lightweight container that maintains persistent SSH tunnel

FROM alpine/ssh:latest

# Install netcat for health checks
RUN apk add --no-cache netcat-openbsd

# Create non-root user for security
RUN addgroup -g 1000 tunnel && \
    adduser -D -u 1000 -G tunnel tunnel

# Create SSH directory
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh

# Health check script
COPY <<-'EOF' /healthcheck.sh
#!/bin/sh
# Check if SSH tunnel is running and port is listening
if nc -z localhost 18789 2>/dev/null; then
    echo "✅ SSH tunnel healthy - port 18789 listening"
    exit 0
else
    echo "❌ SSH tunnel unhealthy - port 18789 not listening"
    exit 1
fi
EOF

RUN chmod +x /healthcheck.sh

# Set working directory
WORKDIR /root

# Default command (overridden in docker-compose.yml)
CMD ["sh", "-c", "echo 'Use docker-compose to run'"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["/healthcheck.sh"]
