/**
 * WebSocket Reconnection with Exponential Backoff
 *
 * Automatically reconnects to WebSocket server with exponential backoff
 * and jitter to prevent thundering herd problem.
 */

export interface ReconnectOptions {
  /** Maximum retry attempts (default: 10) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Callback on successful connection */
  onConnect?: () => void;
  /** Callback on disconnection */
  onDisconnect?: (event: CloseEvent) => void;
  /** Callback on reconnection attempt */
  onReconnectAttempt?: (attempt: number, delay: number) => void;
  /** Callback on max retries exceeded */
  onMaxRetriesExceeded?: () => void;
  /** Callback on any error */
  onError?: (error: Event) => void;
}

/**
 * WebSocket client with automatic reconnection
 */
export class WebSocketReconnect {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<ReconnectOptions>;
  private reconnectAttempt = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(url: string, options: ReconnectOptions = {}) {
    this.url = url;
    this.options = {
      maxRetries: options.maxRetries || 10,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffMultiplier: options.backoffMultiplier || 2,
      jitter: options.jitter !== false,
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onReconnectAttempt: options.onReconnectAttempt || (() => {}),
      onMaxRetriesExceeded: options.onMaxRetriesExceeded || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Connect to WebSocket server
   *
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.isManualClose = false;
      this.reconnectAttempt = 0;
      this.attemptConnection(resolve, reject);
    });

    return this.connectionPromise;
  }

  /**
   * Attempt to establish connection
   */
  private attemptConnection(resolve: () => void, reject: (error: any) => void): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected to ${this.url}`);
        this.reconnectAttempt = 0;
        this.connectionPromise = null;
        resolve();
        this.options.onConnect();
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected: ${event.code} ${event.reason}`);
        this.options.onDisconnect(event);

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error(`[WebSocket] Error:`, error);
        this.options.onError(error);
      };

      this.ws.onmessage = (event) => {
        // Message handling is done by the consumer
        console.log(`[WebSocket] Message received:`, event.data);
      };
    } catch (error) {
      console.error(`[WebSocket] Connection error:`, error);
      reject(error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.options.maxRetries) {
      console.error(`[WebSocket] Max retries (${this.options.maxRetries}) exceeded`);
      this.options.onMaxRetriesExceeded();
      this.connectionPromise = null;
      return;
    }

    const delay = this.calculateDelay();
    this.reconnectAttempt++;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.options.maxRetries})`
    );

    this.options.onReconnectAttempt(this.reconnectAttempt, delay);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.attemptConnection(
        () => {},
        () => {}
      );
    }, delay);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(): number {
    const exponentialDelay =
      this.options.initialDelay *
      Math.pow(this.options.backoffMultiplier, this.reconnectAttempt - 1);

    const delay = Math.min(exponentialDelay, this.options.maxDelay);

    // Add jitter (±25%) to prevent thundering herd
    if (this.options.jitter) {
      const jitterRange = delay * 0.25;
      return delay - jitterRange + Math.random() * (jitterRange * 2);
    }

    return delay;
  }

  /**
   * Send message through WebSocket
   *
   * @param data - Message data to send
   * @throws Error if not connected
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(data);
  }

  /**
   * Close WebSocket connection
   *
   * @param code - Close code (default: 1000)
   * @param reason - Close reason
   */
  close(code = 1000, reason = 'Normal closure'): void {
    this.isManualClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }

    this.connectionPromise = null;
  }

  /**
   * Get current connection state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Create WebSocket with reconnection
 *
 * @param url - WebSocket server URL
 * @param options - Reconnection options
 * @returns WebSocketReconnect instance
 *
 * @example
 * const ws = createWebSocketReconnect('ws://localhost:4000', {
 *   onConnect: () => console.log('Connected!'),
 *   onDisconnect: () => console.log('Disconnected'),
 * });
 *
 * await ws.connect();
 * ws.send(JSON.stringify({ type: 'message', data: 'Hello!' }));
 */
export function createWebSocketReconnect(
  url: string,
  options: ReconnectOptions = {}
): WebSocketReconnect {
  return new WebSocketReconnect(url, options);
}
