/**
 * SSH Tunnel + Direct WebSocket Connection Prototype
 *
 * This module creates an SSH tunnel from the container to the host,
 * then connects to the OpenClaw Gateway via WebSocket through the tunnel.
 *
 * Usage:
 *   node ssh-tunnel-websocket.js
 *
 * Requirements:
 *   - SSH server running on host (port 22)
 *   - SSH key or password for authentication
 *   - OpenClaw Gateway running on host (port 18789)
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');

class OpenClawWebSocketClient {
  constructor(config) {
    this.sshHost = config.sshHost || 'host.docker.internal';
    this.sshPort = config.sshPort || 22;
    this.sshUser = config.sshUser || 'root';
    this.sshKey = config.sshKey; // Path to SSH private key
    this.localPort = config.localPort || 18789;
    this.gatewayToken = config.gatewayToken;
    this.agentId = config.agentId || 'main';

    this.sshTunnel = null;
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * Step 1: Create SSH tunnel
   * ssh -N -f -L localPort:127.0.0.1:18789 user@host
   */
  async createSSHTunnel() {
    return new Promise((resolve, reject) => {
      const args = [
        '-N', // No remote command (just port forwarding)
        '-f', // Fork to background
        '-o',
        'StrictHostKeyChecking=no', // Don't ask about host key
        '-o',
        'UserKnownHostsFile=/dev/null', // Don't store host key
        '-L',
        `${this.localPort}:127.0.0.1:18789`,
        `${this.sshUser}@${this.sshHost}`,
        '-p',
        this.sshPort.toString(),
      ];

      // Add SSH key if provided
      if (this.sshKey) {
        args.unshift('-i', this.sshKey);
      }

      console.log(`[SSH] Creating tunnel: ssh ${args.join(' ')}`);

      this.sshTunnel = spawn('ssh', args);

      this.sshTunnel.on('error', (err) => {
        console.error('[SSH] Tunnel error:', err.message);
        reject(err);
      });

      this.sshTunnel.on('close', (code) => {
        console.log(`[SSH] Tunnel closed with code ${code}`);
        this.isConnected = false;
      });

      // Give SSH time to establish connection
      setTimeout(() => {
        console.log('[SSH] Tunnel created successfully');
        resolve();
      }, 3000);
    });
  }

  /**
   * Step 2: Connect to local WebSocket through tunnel
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://127.0.0.1:${this.localPort}`;
      console.log(`[WS] Connecting to ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this.gatewayToken}`,
        },
      });

      this.ws.on('open', () => {
        console.log('[WS] Connected to Gateway');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[WS] Connection error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('[WS] Connection closed');
        this.isConnected = false;
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Step 3: Send message through WebSocket
   */
  async sendMessage(content) {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Gateway');
    }

    const message = {
      type: 'agent.run',
      agentId: this.agentId,
      content: content,
      timestamp: new Date().toISOString(),
    };

    console.log('[WS] Sending:', message);
    this.ws.send(JSON.stringify(message));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 30000);

      this.ws.once('message', (data) => {
        clearTimeout(timeout);
        const response = JSON.parse(data.toString());
        console.log('[WS] Received:', response);
        resolve(response);
      });

      this.ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConnected) {
      return { status: 'disconnected' };
    }

    try {
      const response = await this.sendMessage('health check');
      return { status: 'healthy', response };
    } catch (err) {
      return { status: 'unhealthy', error: err.message };
    }
  }

  /**
   * Cleanup
   */
  async disconnect() {
    console.log('[Cleanup] Closing connections...');

    if (this.ws) {
      this.ws.close();
    }

    if (this.sshTunnel) {
      this.sshTunnel.kill('SIGTERM');
    }

    this.isConnected = false;
  }
}

// ============ MAIN ============

async function main() {
  console.log('🚀 OpenClaw SSH Tunnel + WebSocket Prototype\n');

  const config = {
    sshHost: process.env.SSH_HOST || 'host.docker.internal',
    sshPort: parseInt(process.env.SSH_PORT) || 22,
    sshUser: process.env.SSH_USER || 'root',
    sshKey: process.env.SSH_KEY_PATH, // Optional: path to SSH private key
    localPort: 18789,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'agent-hub-demo-token-2026',
    agentId: 'main',
  };

  console.log('Configuration:', {
    sshHost: config.sshHost,
    sshPort: config.sshPort,
    sshUser: config.sshUser,
    hasSSHKey: !!config.sshKey,
    gatewayToken: config.gatewayToken ? '***' : 'none',
  });
  console.log('');

  const client = new OpenClawWebSocketClient(config);

  try {
    // Step 1: Create SSH tunnel
    console.log('📡 Step 1: Creating SSH tunnel...');
    await client.createSSHTunnel();

    // Step 2: Connect to WebSocket
    console.log('\n🔌 Step 2: Connecting to WebSocket...');
    await client.connectWebSocket();

    // Step 3: Send test message
    console.log('\n💬 Step 3: Sending test message...');
    const response = await client.sendMessage('Hello from SSH tunnel prototype!');
    console.log('✅ Response received:', response);

    // Health check
    console.log('\n❤️ Health check...');
    const health = await client.healthCheck();
    console.log('Health status:', health);

    console.log('\n✅ Prototype verification COMPLETE!\n');

    // Keep running for a bit to show it's stable
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (err) {
    console.error('\n❌ Prototype FAILED:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure SSH server is running on host: sudo systemctl start ssh');
    console.error('2. Ensure SSH key is set up: ssh-copy-id user@host');
    console.error('3. Ensure Gateway is running: openclaw gateway run');
    console.error('4. Check firewall: sudo ufw allow 22/tcp');
  } finally {
    await client.disconnect();
    process.exit(0);
  }
}

// Export for use as module
module.exports = { OpenClawWebSocketClient };

// Run if executed directly
if (require.main === module) {
  main();
}
