/**
 * Centralized Error Handling Utility
 * Provides consistent error handling patterns across all services
 */

/**
 * Application Error Types
 */
export enum ErrorType {
  DATABASE = 'DATABASE_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  WEBSOCKET = 'WEBSOCKET_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * Standardized Application Error
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;
    this.timestamp = new Date();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create specific error types
 */
export const errors = {
  database: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorType.DATABASE, 500, context),
  
  validation: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorType.VALIDATION, 400, context),
  
  notFound: (resource: string, id?: string) =>
    new AppError(
      `${resource} not found${id ? `: ${id}` : ''}`,
      ErrorType.NOT_FOUND,
      404,
      { resource, id }
    ),
  
  authentication: (message: string = 'Authentication required') =>
    new AppError(message, ErrorType.AUTHENTICATION, 401),
  
  authorization: (message: string = 'Not authorized') =>
    new AppError(message, ErrorType.AUTHORIZATION, 403),
  
  externalService: (service: string, message: string, context?: Record<string, any>) =>
    new AppError(
      `${service} error: ${message}`,
      ErrorType.EXTERNAL_SERVICE,
      503,
      { service, ...context }
    ),
  
  websocket: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorType.WEBSOCKET, 500, context),
  
  unknown: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorType.UNKNOWN, 500, context),
};

/**
 * Safe execution wrapper
 * Executes async function and handles errors consistently
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap unknown errors in AppError
    const appError = errors.unknown(errorMessage, {
      originalError: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });
    
    // Log error for debugging
    console.error('[ErrorHandler]', {
      type: appError.type,
      message: appError.message,
      context: appError.context,
      timestamp: appError.timestamp,
    });
    
    throw appError;
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error): {
  success: false;
  error: {
    message: string;
    type: string;
    statusCode: number;
    timestamp: string;
  };
} {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.type,
        statusCode: error.statusCode,
        timestamp: error.timestamp.toISOString(),
      },
    };
  }
  
  // Unknown error
  return {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      type: 'UNKNOWN_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Log error with context for debugging
 */
export function logError(
  error: Error,
  context: {
    service: string;
    operation: string;
    userId?: string;
    requestId?: string;
  }
): void {
  console.error('[ErrorHandler]', {
    service: context.service,
    operation: context.operation,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context: {
      userId: context.userId,
      requestId: context.requestId,
    },
    timestamp: new Date().toISOString(),
  });
}
