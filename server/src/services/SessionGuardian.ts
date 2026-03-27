import { prisma } from '../index.js';
import { OpenClawService } from './OpenClawService.js';

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
      console.log('[SessionGuardian] Already running');
      return;
    }

    this.running = true;
    console.log(`[SessionGuardian] Starting (check interval: ${this.checkInterval}ms)`);

    // Initial check
    await this.checkAllSessions();

    // Periodic health checks
    this.checkTimer = setInterval(() => {
      this.checkAllSessions().catch(console.error);
    }, this.checkInterval);

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
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
    console.log('[SessionGuardian] Stopped');
  }

  /**
   * Check health of all active sessions
   */
  async checkAllSessions(): Promise<SessionHealth[]> {
    const results: SessionHealth[] = [];

    // Get all rooms with OpenClaw sessions
    const rooms = await prisma.room.findMany({
      where: {
        openclawSessionId: { not: null },
      },
    });

    console.log(`[SessionGuardian] Checking ${rooms.length} sessions...`);

    for (const room of rooms) {
      const health = await this.checkSessionHealth(room);
      results.push(health);

      if (!health.healthy) {
        console.log(`[SessionGuardian] Unhealthy session detected for room ${room.id}: ${health.error}`);
        await this.recoverSession(room);
      }
    }

    return results;
  }

  /**
   * Check health of a single session
   */
  async checkSessionHealth(room: any): Promise<SessionHealth> {
    const sessionId = room.openclawSessionId;
    if (!sessionId) {
      return {
        roomId: room.id,
        healthy: false,
        error: 'No session ID',
        age: 0,
      };
    }

    // CLI-based integration is stateless - no persistent sessions
    // Health check: verify OpenClaw CLI is available
    const health = await OpenClawService.checkSessionHealth(room.id);
    return {
      roomId: room.id,
      healthy: health.healthy,
      sessionId: room.openclawSessionId || 'stateless',
      error: health.error,
      age: room.sessionCreatedAt ? Date.now() - room.sessionCreatedAt.getTime() : 0,
    };
  }

  /**
   * Recover a broken/expired session
   * For CLI-based integration, this is a no-op (stateless)
   */
  async recoverSession(room: any): Promise<void> {
    console.log(`[SessionGuardian] Session recovery not needed for CLI-based integration (room ${room.id})`);
    
    // CLI is stateless - no sessions to recover
    // This method is kept for API compatibility
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    console.log('[SessionGuardian] Running cleanup...');

    const expired = await OpenClawService.cleanupExpiredSessions();

    // Update database for expired sessions
    for (const sessionId of expired) {
      const room = await prisma.room.findFirst({
        where: { openclawSessionId: sessionId },
      });

      if (room) {
        await prisma.room.update({
          where: { id: room.id },
          data: {
            openclawSessionId: null,
            sessionCreatedAt: null,
          },
        });
        console.log(`[SessionGuardian] Cleaned up expired session for room ${room.id}`);
      }
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
      activeSessions: OpenClawService.getAllSessions().length,
    };
  }
}

export const SessionGuardian = new SessionGuardianClass();
