import { prisma } from '../index.js';
import { openClawService } from './OpenClawService.js';
import logger from '../config/logger.js';

export interface SessionHealth {
  roomId: string;
  healthy: boolean;
  sessionId?: string;
  error?: string;
  age: number;
}

class SessionGuardianClass {
  private checkInterval: number;
  private cleanupInterval: number;
  private running: boolean = false;
  private checkTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.checkInterval = parseInt(process.env.SESSION_CHECK_INTERVAL || '30000'); // 30 seconds
    this.cleanupInterval = 3600000; // 1 hour
  }

  /**
   * Start the Session Guardian
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.info('[SessionGuardian] Already running');
      return;
    }

    this.running = true;
    logger.info(`[SessionGuardian] Starting (check interval: ${this.checkInterval}ms)`);

    // Initial check
    await this.checkAllSessions();

    // Periodic health checks
    this.checkTimer = setInterval(() => {
      this.checkAllSessions().catch((err) => logger.error('[SessionGuardian] Check error:', err));
    }, this.checkInterval);

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((err) =>
        logger.error('[SessionGuardian] Cleanup error:', err)
      );
    }, this.cleanupInterval);
  }

  /**
   * Stop the Session Guardian
   */
  stop(): void {
    this.running = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    logger.info('[SessionGuardian] Stopped');
  }

  /**
   * Check health of all active sessions
   */
  async checkAllSessions(): Promise<SessionHealth[]> {
    const results: SessionHealth[] = [];

    // Get all active sessions from Session model (replaces legacy Room.openclawSessionId)
    const sessions = await prisma.session.findMany({
      where: { status: 'active' },
      include: { room: true },
    });

    logger.info(`[SessionGuardian] Checking ${sessions.length} sessions...`);

    for (const session of sessions) {
      const health: SessionHealth = {
        roomId: session.roomId,
        healthy: true,
        sessionId: session.sessionId,
        age: Date.now() - session.lastUsedAt.getTime(),
      };
      results.push(health);
    }

    return results;
  }

  /**
   * Check health of a single session
   */
  async checkSessionHealth(session: any): Promise<SessionHealth> {
    const sessionId = session.sessionId;
    if (!sessionId) {
      return {
        roomId: session.roomId || '',
        healthy: false,
        error: 'No session ID',
        age: 0,
      };
    }

    // CLI-based integration is stateless - no persistent sessions
    const health = await openClawService.healthCheck();
    return {
      roomId: session.roomId,
      healthy: health.healthy,
      sessionId: sessionId,
      error: health.error,
      age: session.lastUsedAt ? Date.now() - session.lastUsedAt.getTime() : 0,
    };
  }

  /**
   * Recover a broken/expired session
   * For CLI-based integration, this is a no-op (stateless)
   */
  async recoverSession(session: any): Promise<void> {
    logger.info(
      `[SessionGuardian] Session recovery not needed for CLI-based integration (session ${session.sessionId})`
    );

    // CLI is stateless - no sessions to recover
    // This method is kept for API compatibility
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    logger.info('[SessionGuardian] Running cleanup...');

    // Find sessions that have expired based on expiresAt
    const now = new Date();
    const expiredSessions = await prisma.session.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: now },
      },
    });

    // Mark expired sessions in database
    for (const session of expiredSessions) {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      logger.info(`[SessionGuardian] Marked session ${session.sessionId} as expired`);
    }
  }

  /**
   * Get guardian status
   */
  getStatus() {
    return {
      running: this.running,
      checkInterval: this.checkInterval,
      cleanupInterval: this.cleanupInterval,
      activeSessions: 0, // Session tracking via Session model
    };
  }
}

export const SessionGuardian = new SessionGuardianClass();
