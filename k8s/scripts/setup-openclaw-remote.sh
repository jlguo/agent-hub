#!/bin/bash
# OpenClaw Remote Access Setup Script
# Usage: ./setup-openclaw-remote.sh

set -e

echo "🦞 OpenClaw Remote Access Setup"
echo "================================"
echo ""

# Check if openclaw CLI is installed
if ! command -v openclaw &> /dev/null; then
    echo "❌ OpenClaw CLI not found"
    echo ""
    echo "Installing OpenClaw CLI..."
    echo ""
    
    # Check if npm is available
    if command -v npm &> /dev/null; then
        echo "📦 Installing via npm..."
        npm install -g openclaw@latest
    # Check if curl is available for installer script
    elif command -v curl &> /dev/null; then
        echo "📦 Installing via official installer script..."
        curl -fsSL https://openclaw.ai/install.sh | bash
        # Source the shell config to get openclaw in PATH
        if [ -f "$HOME/.bashrc" ]; then
            source "$HOME/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            source "$HOME/.zshrc"
        fi
    else
        echo "❌ Neither npm nor curl found"
        echo ""
        echo "Please install OpenClaw CLI manually:"
        echo "  Option 1 (npm): npm install -g openclaw@latest"
        echo "  Option 2 (curl): curl -fsSL https://openclaw.ai/install.sh | bash"
        exit 1
    fi
    
    # Verify installation
    if command -v openclaw &> /dev/null; then
        echo "✅ OpenClaw CLI installed successfully"
        openclaw --version
    else
        echo "❌ Installation failed"
        echo ""
        echo "Please install manually and re-run this script"
        exit 1
    fi
else
    echo "✅ OpenClaw CLI found: $(openclaw --version)"
fi
echo ""

# Get remote host configuration
read -p "Remote host IP/hostname: " REMOTE_HOST
read -p "Remote SSH username: " SSH_USER
read -p "SSH port (default: 22): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}
read -p "Gateway token: " -s GATEWAY_TOKEN
echo ""

# Verify SSH connection
echo ""
echo "🔍 Testing SSH connection..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 -p "$SSH_PORT" "$SSH_USER@$REMOTE_HOST" "echo success" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed"
    echo "Make sure:"
    echo "  1. SSH key is set up: ssh-copy-id $SSH_USER@$REMOTE_HOST"
    echo "  2. Remote host is reachable"
    exit 1
fi

# Configure OpenClaw CLI for remote mode
echo ""
echo "⚙️  Configuring OpenClaw CLI for remote mode..."
openclaw config set gateway.mode remote
openclaw config set gateway.remote.url "ws://127.0.0.1:18789"
openclaw config set gateway.remote.token "$GATEWAY_TOKEN"

echo "✅ OpenClaw CLI configured"
openclaw config get gateway

# Test gateway connection (requires SSH tunnel running)
echo ""
echo "🔍 Testing gateway connection..."
if openclaw health 2>/dev/null; then
    echo "✅ Gateway connection successful"
else
    echo "⚠️  Gateway connection failed (SSH tunnel may not be running)"
    echo "Start SSH tunnel with:"
    echo "  ssh -N -L 18789:127.0.0.1:18789 $SSH_USER@$REMOTE_HOST"
fi

# Create SSH config entry
echo ""
echo "📝 Creating SSH config entry..."
SSH_CONFIG="$HOME/.ssh/config"
if ! grep -q "Host openclaw-remote" "$SSH_CONFIG" 2>/dev/null; then
    cat >> "$SSH_CONFIG" << EOF

Host openclaw-remote
    HostName $REMOTE_HOST
    User $SSH_USER
    Port $SSH_PORT
    LocalForward 18789 127.0.0.1:18789
    ServerAliveInterval 60
    ExitOnForwardFailure yes
EOF
    echo "✅ SSH config updated"
else
    echo "⚠️  SSH config already has openclaw-remote entry"
fi

# Setup persistent tunnel (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    read -p "Setup persistent SSH tunnel with systemd? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
        SERVICE_FILE="$SCRIPT_DIR/openclaw-ssh-tunnel.service"
        
        # Update service file with actual values
        sed -i "s/your-user/$SSH_USER/g" "$SERVICE_FILE"
        sed -i "s/your-remote-host/$REMOTE_HOST/g" "$SERVICE_FILE"
        
        # Install systemd service
        echo "📋 Installing systemd service..."
        sudo cp "$SERVICE_FILE" /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable openclaw-ssh-tunnel
        sudo systemctl start openclaw-ssh-tunnel
        
        echo "✅ Persistent SSH tunnel configured"
        echo ""
        echo "Check status with: systemctl status openclaw-ssh-tunnel"
        echo "View logs with: journalctl -u openclaw-ssh-tunnel -f"
    fi
fi

# macOS LaunchAgent setup
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    read -p "Setup persistent SSH tunnel with LaunchAgent? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        LAUNCHAGENT_FILE="$HOME/Library/LaunchAgents/ai.openclaw.ssh-tunnel.plist"
        mkdir -p "$(dirname "$LAUNCHAGENT_FILE")"
        
        cat > "$LAUNCHAGENT_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>-o</string>
        <string>ServerAliveInterval=60</string>
        <string>-o</string>
        <string>ExitOnForwardFailure=yes</string>
        <string>-L</string>
        <string>18789:127.0.0.1:18789</string>
        <string>$SSH_USER@$REMOTE_HOST</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
        
        # Load the LaunchAgent
        launchctl bootstrap gui/$UID "$LAUNCHAGENT_FILE"
        
        echo "✅ Persistent SSH tunnel configured (LaunchAgent)"
        echo ""
        echo "Check status with: launchctl list | grep openclaw"
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start SSH tunnel: ssh -N openclaw-remote"
echo "  2. Test connection: openclaw health"
echo "  3. Test agent: openclaw agent --message 'test' --agent 'family-mom'"
echo ""
echo "For Docker deployment, see: docs/OPENCLAW-REMOTE-SETUP.md"
