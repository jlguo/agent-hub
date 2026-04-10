/**
 * OpenClawService - Factory Pattern for Testability
 *
 * Provides factory function to create isolated instances.
 * Each instance is independent, enabling proper unit testing.
 *
 * Usage:
 *   const service = createOpenClawService(); // Production singleton
 *   const testService = createOpenClawService({ mode: 'cli' }); // Test instance
 */

export interface OpenClawConfig {
  mode?: 'http' | 'cli' | 'remote';
  gatewayUrl?: string;
  verificationToken?: string;
}

export interface OpenClawHealthResult {
  mode: string;
  healthy: boolean;
  error?: string;
  tunnel?: 'connected' | 'disconnected';
  feishu?: 'ok' | 'error';
  agents?: string[];
}

export interface OpenClawSendResult {
  success: boolean;
  response?: string;
  error?: string;
}

export class OpenClawService {
  private mode: 'http' | 'cli' | 'remote';
  private gatewayUrl?: string;
  private verificationToken?: string;

  constructor(config: OpenClawConfig = {}) {
    this.mode = config.mode || (process.env.OPENCLAW_MODE as 'http' | 'cli' | 'remote') || 'cli';
    this.gatewayUrl = config.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL;
    this.verificationToken = config.verificationToken || process.env.OPENCLAW_VERIFICATION_TOKEN;

    console.log(`[OpenClawService] Mode: ${this.mode.toUpperCase()}`);

    if (this.mode === 'remote') {
      console.log(`[OpenClawService] Remote mode configured`);
      console.log(
        `[OpenClawService] Gateway URL: ${this.gatewayUrl || 'ws://127.0.0.1:18789 (default)'}`
      );
      console.log(
        `[OpenClawService] Note: Remote mode uses OpenClaw CLI with gateway.remote.* config`
      );
      console.log(
        `[OpenClawService] Ensure SSH tunnel is running: ssh -N -L 18789:127.0.0.1:18789 user@remote-host`
      );
    }

    if (this.mode === 'http' && !this.verificationToken) {
      throw new Error('OPENCLAW_VERIFICATION_TOKEN required for HTTP mode');
    }
  }

  async sendMessage(
    message: string,
    agentId: string,
    sessionId: string
  ): Promise<OpenClawSendResult> {
    console.log(`[OpenClawService] Sending message via ${this.mode.toUpperCase()} mode`);
    console.log(`[OpenClawService] Agent: ${agentId}, Session: ${sessionId}`);
    console.log(`[OpenClawService] Message: ${message.substring(0, 50)}...`);

    try {
      if (this.mode === 'cli' || this.mode === 'remote') {
        return await this.sendViaCLI(message, agentId, sessionId);
      } else if (this.mode === 'http') {
        return await this.sendViaHTTP(message, agentId, sessionId);
      } else {
        throw new Error(`Invalid OPENCLAW_MODE: ${this.mode}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[OpenClawService] Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendViaCLI(
    message: string,
    agentId: string,
    sessionId: string
  ): Promise<OpenClawSendResult> {
    const { execAsync } = await import('../utils/exec.js');
    const command = `openclaw agent --message "${message}" --agent "${agentId}" --session-id "${sessionId}"`;

    console.log(`[OpenClawService] Executing: ${command}`);

    try {
      const { stdout } = await execAsync(command);
      const response = stdout.trim();

      if (!response) {
        return {
          success: false,
          error: 'Empty response from OpenClaw CLI',
        };
      }

      return {
        success: true,
        response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CLI execution failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendViaHTTP(
    message: string,
    agentId: string,
    sessionId: string
  ): Promise<OpenClawSendResult> {
    if (!this.gatewayUrl || !this.verificationToken) {
      return {
        success: false,
        error: 'HTTP mode requires OPENCLAW_GATEWAY_URL and OPENCLAW_VERIFICATION_TOKEN',
      };
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/api/openclaw/gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.verificationToken}`,
        },
        body: JSON.stringify({
          action: 'agent.run',
          params: { message, agentId, sessionId },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        response: result.response || result.output,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'HTTP request failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async healthCheck(): Promise<OpenClawHealthResult> {
    console.log(`[OpenClawService] Health check - Mode: ${this.mode}`);

    const result: OpenClawHealthResult = {
      mode: this.mode,
      healthy: true,
    };

    try {
      if (this.mode === 'cli' || this.mode === 'remote') {
        const { execAsync } = await import('../utils/exec.js');

        try {
          const { stdout } = await execAsync('openclaw health', { timeout: 5000 });
          const output = stdout.trim();

          // Parse health output
          if (output.includes('Feishu: ok')) {
            result.feishu = 'ok';
          } else if (output.includes('Feishu: error')) {
            result.feishu = 'error';
            result.healthy = false;
          }

          // Extract agent list
          const agentMatch = output.match(/Agents:\s*([^\n]+)/);
          if (agentMatch) {
            result.agents = agentMatch[1].split(',').map((a) => a.trim());
          }

          // Check tunnel status for remote mode
          if (this.mode === 'remote') {
            if (output.includes('Gateway: connected') || output.includes('tunnel: active')) {
              result.tunnel = 'connected';
            } else if (
              output.includes('Gateway: disconnected') ||
              output.includes('tunnel: inactive')
            ) {
              result.tunnel = 'disconnected';
              result.healthy = false;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'CLI health check failed';
          result.healthy = false;
          result.error = errorMessage;
        }
      } else if (this.mode === 'http') {
        if (!this.gatewayUrl || !this.verificationToken) {
          result.healthy = false;
          result.error = 'HTTP mode requires OPENCLAW_GATEWAY_URL and OPENCLAW_VERIFICATION_TOKEN';
        } else {
          try {
            const response = await fetch(`${this.gatewayUrl}/health`, {
              headers: {
                Authorization: `Bearer ${this.verificationToken}`,
              },
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            result.healthy = true;
          } catch (error) {
            result.healthy = false;
            result.error = error instanceof Error ? error.message : 'HTTP health check failed';
          }
        }
      }
    } catch (error) {
      result.healthy = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    console.log(`[OpenClawService] Health check result:`, result);
    return result;
  }
}

/**
 * Factory function to create OpenClawService instances.
 *
 * @param config - Optional configuration override
 * @returns New OpenClawService instance
 *
 * @example
 * // Production singleton
 * export const openClawService = createOpenClawService();
 *
 * @example
 * // Test instance with custom config
 * const testService = createOpenClawService({ mode: 'cli' });
 */
export function createOpenClawService(config: OpenClawConfig = {}): OpenClawService {
  return new OpenClawService(config);
}

// Production singleton instance (for backward compatibility)
export const openClawService = createOpenClawService();
