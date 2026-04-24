/**
 * Application Configuration
 *
 * Centralized configuration for application-level constants.
 * All values can be overridden via environment variables.
 */

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
 * Mention & Cooldown Configuration
 */
export const mentionConfig = {
  /** Cooldown period in ms after an agent is @mentioned */
  cooldownMs: parseIntEnv('MENTION_COOLDOWN_MS', 60000),
  /** Cleanup interval in ms for expired cooldowns */
  cleanupIntervalMs: parseIntEnv('MENTION_CLEANUP_INTERVAL_MS', 120000),
};

/**
 * Message Query Configuration
 */
export const messageQueryConfig = {
  /** Number of recent messages to fetch for agent context */
  recentMessageLimit: parseIntEnv('RECENT_MESSAGE_LIMIT', 20),
  /** Number of recent messages for @mention followup context */
  followupMessageLimit: parseIntEnv('FOLLOWUP_MESSAGE_LIMIT', 15),
  /** Default message pagination limit */
  defaultPaginationLimit: parseIntEnv('DEFAULT_PAGINATION_LIMIT', 200),
  /** Maximum allowed pagination limit (hard cap) */
  maxPaginationLimit: parseIntEnv('MAX_PAGINATION_LIMIT', 500),
};

/**
 * Agent Response Configuration
 */
export const agentResponseConfig = {
  /** Minimum delay in ms between multiple agent responses */
  responseDelayMinMs: parseIntEnv('AGENT_RESPONSE_DELAY_MIN_MS', 2000),
  /** Maximum additional random delay in ms */
  responseDelayMaxMs: parseIntEnv('AGENT_RESPONSE_DELAY_MAX_MS', 1000),
  /** Base probability of agent responding (0-1) when no @mention */
  baseResponseProbability: parseFloatEnv('BASE_RESPONSE_PROBABILITY', 0.6),
};
