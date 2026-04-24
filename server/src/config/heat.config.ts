/**
 * Heat System Configuration
 *
 * Centralized configuration for heat-based agent engagement system.
 * All values can be overridden via environment variables.
 *
 * @see {@link ../../services/MessageService.ts} for usage
 */

export interface HeatConfig {
  baseIncrement: number;
  userMessageMultiplier: number;
  agentMessageMultiplier: number;
  decayRate: number;
  decayIntervalMs: number;
  thresholds: {
    hot: number;
    warm: number;
    cold: number;
    inactive: number;
  };
}

/**
 * Parse integer from environment variable with fallback
 */
function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float from environment variable with fallback
 */
function parseFloatEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Heat configuration with environment variable overrides
 *
 * Environment Variables:
 * - HEAT_BASE_INCREMENT: Base heat per message (default: 25)
 * - HEAT_USER_MULTIPLIER: Multiplier for user messages (default: 2.0)
 * - HEAT_AGENT_MULTIPLIER: Multiplier for agent messages (default: 0.8)
 * - HEAT_DECAY_RATE: Decay rate per cycle (default: 0.12)
 */
export const heatConfig: HeatConfig = {
  baseIncrement: parseIntEnv('HEAT_BASE_INCREMENT', 25),
  userMessageMultiplier: parseFloatEnv('HEAT_USER_MULTIPLIER', 2.0),
  agentMessageMultiplier: parseFloatEnv('HEAT_AGENT_MULTIPLIER', 0.8),
  decayRate: parseFloatEnv('HEAT_DECAY_RATE', 0.12),
  decayIntervalMs: parseIntEnv('HEAT_DECAY_INTERVAL_MS', 30000),
  thresholds: {
    hot: parseIntEnv('HEAT_THRESHOLD_HOT', 70),
    warm: parseIntEnv('HEAT_THRESHOLD_WARM', 40),
    cold: parseIntEnv('HEAT_THRESHOLD_COLD', 20),
    inactive: parseIntEnv('HEAT_THRESHOLD_INACTIVE', 5),
  },
};

/**
 * Get response probability based on heat level
 *
 * @param heat Current heat level (0-100)
 * @returns Probability of agent response (0.0-1.0)
 */
export function getResponseProbability(heat: number): number {
  if (heat >= heatConfig.thresholds.hot) {
    return 0.8; // 80% chance in HOT zone
  } else if (heat >= heatConfig.thresholds.warm) {
    return 0.6; // 60% chance in WARM zone
  } else if (heat >= heatConfig.thresholds.cold) {
    return 0.4; // 40% chance in COLD zone
  } else if (heat >= heatConfig.thresholds.inactive) {
    return 0.2; // 20% chance in INACTIVE zone
  } else {
    return 0.1; // 10% chance below INACTIVE
  }
}

/**
 * Get heat status label
 *
 * @param heat Current heat level
 * @returns Status label (HOT, WARM, COLD, INACTIVE)
 */
export function getHeatStatus(heat: number): string {
  if (heat >= heatConfig.thresholds.hot) return 'HOT';
  if (heat >= heatConfig.thresholds.warm) return 'WARM';
  if (heat >= heatConfig.thresholds.cold) return 'COLD';
  if (heat >= heatConfig.thresholds.inactive) return 'INACTIVE';
  return 'DEAD';
}

/**
 * Calculate heat increment for a message
 *
 * @param isUserMessage True if message is from human user
 * @returns Heat increment value
 */
export function calculateHeatIncrement(isUserMessage: boolean): number {
  const multiplier = isUserMessage
    ? heatConfig.userMessageMultiplier
    : heatConfig.agentMessageMultiplier;

  return heatConfig.baseIncrement * multiplier;
}
