import { Server } from 'socket.io';
export interface WebSocketEvent<T = any> {
    event: string;
    data: T;
}
/**
 * Setup WebSocket handlers for Socket.io
 */
export declare function setupWebSocket(io: Server): void;
/**
 * Emit session status to room
 */
export declare function emitSessionStatus(io: Server, roomId: string, status: 'connected' | 'disconnected' | 'recovering' | 'recovered'): void;
//# sourceMappingURL=index.d.ts.map