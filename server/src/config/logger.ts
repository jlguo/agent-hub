/**
 * Structured Logging Configuration
 *
 * Winston logger with JSON formatting for production
 * and colored console output for development.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format for development
 * Shows colored output with timestamp and level
 */
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

/**
 * Custom log format for production
 * JSON format with all metadata
 */
const prodFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${stack || message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

/**
 * Create logger instance
 *
 * Development: Colored console output
 * Production: JSON format with file rotation
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? prodFormat : devFormat
  ),
  defaultMeta: { service: 'agent-hub' },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: combine(
        process.env.NODE_ENV !== 'production' ? colorize() : winston.format.uncolorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf(({ level, message, timestamp, stack }) => {
          if (process.env.NODE_ENV === 'production') {
            return JSON.stringify({
              level,
              message: stack || message,
              timestamp,
              service: 'agent-hub',
            });
          }
          return `${timestamp} [${level}]: ${stack || message}`;
        })
      ),
    }),

    // File transport for production (error logs)
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

/**
 * Create child logger with additional context
 *
 * @param context - Additional context to add to all logs
 * @returns Child logger instance
 *
 * @example
 * const roomLogger = logger.child({ roomId: 'room-123' });
 * roomLogger.info('Message received');
 * // Output: { ..., roomId: 'room-123', message: 'Message received' }
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log HTTP request
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param start - Request start time
 */
export function logHttpRequest(req: any, res: any, start: number): void {
  const duration = Date.now() - start;

  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    durationMs: duration,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}

export default logger;
