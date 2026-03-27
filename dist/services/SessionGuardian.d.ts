export interface SessionHealth {
    roomId: string;
    healthy: boolean;
    sessionId?: string;
    error?: string;
    age: number;
}
declare class SessionGuardianClass {
    private checkInterval;
    private cleanupInterval;
    private running;
    private checkTimer?;
    private cleanupTimer?;
    constructor();
    /**
     * Start the Session Guardian
     */
    start(): Promise<void>;
    /**
     * Stop the Session Guardian
     */
    stop(): void;
    /**
     * Check health of all active sessions
     */
    checkAllSessions(): Promise<SessionHealth[]>;
    /**
     * Check health of a single session
     */
    checkSessionHealth(room: any): Promise<SessionHealth>;
    /**
     * Recover a broken/expired session
     * For CLI-based integration, this is a no-op (stateless)
     */
    recoverSession(room: any): Promise<void>;
    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions(): Promise<void>;
    /**
     * Get guardian status
     */
    getStatus(): {
        running: boolean;
        checkInterval: number;
        cleanupInterval: number;
        activeSessions: number;
    };
}
export declare const SessionGuardian: SessionGuardianClass;
export {};
//# sourceMappingURL=SessionGuardian.d.ts.map