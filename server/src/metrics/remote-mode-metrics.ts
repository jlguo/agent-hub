/**
 * Prometheus Metrics for Remote Mode Monitoring
 *
 * These metrics track SSH tunnel health, OpenClaw Gateway connectivity,
 * and overall system health for remote mode deployments.
 */

import { Registry, Gauge, Counter, Histogram } from 'prom-client';

// Create registry for remote mode metrics
export const remoteModeRegistry = new Registry();

// SSH Tunnel Status Gauge
export const sshTunnelConnected = new Gauge({
  name: 'openclaw_ssh_tunnel_connected',
  help: 'SSH tunnel connection status (1 = connected, 0 = disconnected)',
  labelNames: ['host', 'user'],
  registers: [remoteModeRegistry],
});

// Time since last tunnel reconnection
export const sshTunnelUptime = new Gauge({
  name: 'openclaw_ssh_tunnel_uptime_seconds',
  help: 'Time in seconds since SSH tunnel last connected',
  labelNames: ['host'],
  registers: [remoteModeRegistry],
});

// Tunnel reconnection counter
export const sshTunnelReconnects = new Counter({
  name: 'openclaw_ssh_tunnel_reconnects_total',
  help: 'Total number of SSH tunnel reconnections',
  labelNames: ['host', 'reason'],
  registers: [remoteModeRegistry],
});

// OpenClaw Gateway health
export const openclawGatewayHealth = new Gauge({
  name: 'openclaw_gateway_health',
  help: 'OpenClaw Gateway health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['mode', 'gateway_url'],
  registers: [remoteModeRegistry],
});

// Agent response time histogram
export const agentResponseTime = new Histogram({
  name: 'openclaw_agent_response_duration_seconds',
  help: 'Time to get response from OpenClaw agent',
  labelNames: ['agent_name', 'mode'],
  buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120],
  registers: [remoteModeRegistry],
});

// Agent request counter
export const agentRequests = new Counter({
  name: 'openclaw_agent_requests_total',
  help: 'Total number of agent requests',
  labelNames: ['agent_name', 'status', 'mode'],
  registers: [remoteModeRegistry],
});

// Tunnel latency (ping to remote host)
export const sshTunnelLatency = new Histogram({
  name: 'openclaw_ssh_tunnel_latency_seconds',
  help: 'SSH tunnel round-trip latency',
  labelNames: ['host'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [remoteModeRegistry],
});

// Health check failures
export const healthCheckFailures = new Counter({
  name: 'openclaw_health_check_failures_total',
  help: 'Total number of health check failures',
  labelNames: ['component', 'check_type'],
  registers: [remoteModeRegistry],
});

// Last successful health check timestamp
export const lastSuccessfulHealthCheck = new Gauge({
  name: 'openclaw_last_successful_health_check_timestamp',
  help: 'Timestamp of last successful health check (Unix epoch)',
  labelNames: ['component'],
  registers: [remoteModeRegistry],
});

/**
 * Update SSH tunnel metrics
 */
export function updateSshTunnelMetrics(
  connected: boolean,
  host: string,
  user: string,
  uptimeSeconds?: number
): void {
  sshTunnelConnected.set({ host, user }, connected ? 1 : 0);

  if (uptimeSeconds !== undefined) {
    sshTunnelUptime.set({ host }, uptimeSeconds);
  }

  if (!connected) {
    // Tunnel disconnected - will trigger alert
    healthCheckFailures.inc({ component: 'ssh_tunnel', check_type: 'connectivity' });
  } else {
    lastSuccessfulHealthCheck.set({ component: 'ssh_tunnel' }, Date.now() / 1000);
  }
}

/**
 * Update OpenClaw Gateway health metrics
 */
export function updateGatewayHealthMetrics(
  healthy: boolean,
  mode: string,
  gatewayUrl: string
): void {
  openclawGatewayHealth.set({ mode, gateway_url: gatewayUrl }, healthy ? 1 : 0);

  if (healthy) {
    lastSuccessfulHealthCheck.set({ component: 'openclaw_gateway' }, Date.now() / 1000);
  } else {
    healthCheckFailures.inc({ component: 'openclaw_gateway', check_type: 'health' });
  }
}

/**
 * Track agent request
 */
export function trackAgentRequest(
  agentName: string,
  mode: string,
  durationMs: number,
  success: boolean
): void {
  agentRequests.inc({
    agent_name: agentName,
    status: success ? 'success' : 'failure',
    mode: mode,
  });

  agentResponseTime.observe({ agent_name: agentName, mode: mode }, durationMs / 1000);
}

/**
 * Track SSH tunnel reconnection
 */
export function trackSshReconnect(host: string, reason: string): void {
  sshTunnelReconnects.inc({ host, reason });
  sshTunnelConnected.reset();
  sshTunnelUptime.reset();
}

/**
 * Update SSH tunnel latency
 */
export function updateSshLatency(host: string, latencySeconds: number): void {
  sshTunnelLatency.observe({ host }, latencySeconds);
}

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await remoteModeRegistry.metrics();
}
