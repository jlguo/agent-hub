/**
 * SSH Tunnel + Direct WebSocket Connection Prototype
 * ES Module Version
 * 
 * This module creates an SSH tunnel from the container to the host,
 * then connects to the OpenClaw Gateway via WebSocket through the tunnel.
 * 
 * Usage:
 *   node ssh-tunnel-websocket.mjs
 * 
 * Requirements:
 *   - SSH server running on host (port 22)
 *   - SSH key or password for authentication
 *   - OpenClaw Gateway running on host (port 18789)
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';

class OpenClawWebSocketClient {
  constructor(config) {
    this.sshHost = config.sshHost || 'host.docker.internal';
    this.sshPort = config.sshPort || 22;
    this.sshUser = config.sshUser || 'root';
    this.sshKey = config.sshKey;
    this.localPort = config.localPort || 18789;
    this.gatewayToken = config.gatewayToken;
    this.agentId = config.agentId || 'main';
    
    this.sshTunnel = null;
    this.ws = null;
    this.isConnected = false;
  }

  async createSSHTunnel() {
    return new Promise((resolve, reject) => {
      const args = [
        '-N',
        '-f',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-L', `${this.localPort}:127.0.0.1:18789`,
        `${this.sshUser}@${this.sshHost}`,
        '-p', this.sshPort.toString()
      ];

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

      setTimeout(() => {
        console.log('[SSH] Tunnel created successfully');
        resolve();
      }, 3000);
    });
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://127.0.0.1:${this.localPort}`;
      console.log(`[WS] Connecting to ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.gatewayToken}`
        }
      });

      this.ws.on('open', () => {
        console.log('[WS] ✅ Connected to Gateway');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[WS] ❌ Connection error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('[WS] Connection closed');
        this.isConnected = false;
      });

      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  async sendMessage(content) {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Gateway');
    }

    const message = {
      type: 'agent.run',
      agentId: this.agentId,
      content: content,
      timestamp: new Date().toISOString()
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

async function main() {
  console.log('🚀 OpenClaw SSH Tunnel + WebSocket Prototype\n');

  const config = {
    sshHost: process.env.SSH_HOST || 'host.docker.internal',
    sshPort: parseInt(process.env.SSH_PORT) || 22,
    sshUser: process.env.SSH_USER || 'root',
    sshKey: process.env.SSH_KEY_PATH,
    localPort: 18789,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'agent-hub-demo-token-2026',
    agentId: 'main'
  };

  console.log('Configuration:', {
    sshHost: config.sshHost,
    sshPort: config.sshPort,
    sshUser: config.sshUser,
    hasSSHKey: !!config.sshKey,
    gatewayToken: config.gatewayToken ? '***' : 'none'
  });
  console.log('');

  const client = new OpenClawWebSocketClient(config);

  try {
    console.log('📡 Step 1: Creating SSH tunnel...');
    await client.createSSHTunnel();

    console.log('\n🔌 Step 2: Connecting to WebSocket...');
    await client.connectWebSocket();

    console.log('\n💬 Step 3: Sending test message...');
    const response = await client.sendMessage('Hello from SSH tunnel prototype!');
    console.log('✅ Response received:', response);

    console.log('\n❤️ Health check...');
    const health = await client.healthCheck();
    console.log('Health status:', health);

    console.log('\n✅ Prototype verification COMPLETE!\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (err) {
    console.error('\n❌ Prototype FAILED:', err.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure SSH server is running on host: sudo systemctl start ssh');
    console.error('2. Ensure SSH key is set up: ssh-copy-id user@host');
    console.error('3. Ensure Gateway is running: openclaw gateway run');
    console.error('4. Check firewall: sudo ufw allow 22/tcp');
    console.error('\n📋 Current error indicates SSH server is not running on host.');
    console.error('   Install with: sudo apt-get install openssh-server');
  } finally {
    await client.disconnect();
    process.exit(0);
  }
}

export { OpenClawWebSocketClient };

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
