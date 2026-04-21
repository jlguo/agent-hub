/**
 * Centralized Error Handling Utility
 * Provides consistent error handling patterns across all services
 *
 * This is the canonical error system for the entire application.
 * Both service-layer and API middleware use AppError.
 */

/**
 * API Error Code Enum
 *
 * Standardized error codes for programmatic handling
 */
export enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
}

/**
 * Application Error Types (legacy - use ErrorCode instead for new code)
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
 * API Error Response Structure
 */
export interface AppErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

/**
 * Standardized Application Error
 *
 * Unified error class used across both service layer and API middleware.
 * Supports both ErrorCode (API-facing) and ErrorType (service-facing) patterns.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  // Legacy support: type field for service-layer errors
  public readonly type: ErrorType;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;
    this.timestamp = new Date();

    // Map ErrorCode to legacy ErrorType for backward compatibility
    this.type = errorCodeToType(code);

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to API response format
   */
  toResponse(path: string, requestId?: string): AppErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.context,
        timestamp: this.timestamp.toISOString(),
        path,
        requestId,
      },
    };
  }

  /**
   * Create 400 Bad Request error
   */
  static badRequest(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.BAD_REQUEST, 400, details);
  }

  /**
   * Create 401 Unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  /**
   * Create 403 Forbidden error
   */
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  /**
   * Create 404 Not Found error
   */
  static notFound(resource: string = 'Resource'): AppError {
    return new AppError(`${resource} not found`, ErrorCode.NOT_FOUND, 404, { resource });
  }

  /**
   * Create 409 Conflict error
   */
  static conflict(message: string): AppError {
    return new AppError(message, ErrorCode.CONFLICT, 409);
  }

  /**
   * Create 422 Validation Error
   */
  static validationError(details: Record<string, any>): AppError {
    return new AppError('Validation failed', ErrorCode.VALIDATION_ERROR, 422, details);
  }

  /**
   * Create 500 Internal Error
   */
  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
  }

  /**
   * Create 503 Service Unavailable
   */
  static unavailable(message: string = 'Service unavailable'): AppError {
    return new AppError(message, ErrorCode.SERVICE_UNAVAILABLE, 503);
  }

  // Legacy factory methods (for backward compatibility with service layer)

  /** @deprecated Use AppError constructor with ErrorCode instead */
  static database(message: string, context?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.DATABASE_ERROR, 500, context);
  }

  /** @deprecated Use AppError.notFound() instead */
  static notFoundLegacy(resource: string, id?: string): AppError {
    return new AppError(`${resource} not found${id ? `: ${id}` : ''}`, ErrorCode.NOT_FOUND, 404, {
      resource,
      id,
    });
  }

  /** @deprecated Use AppError.unauthorized() instead */
  static authentication(message: string = 'Authentication required'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  /** @deprecated Use AppError.forbidden() instead */
  static authorization(message: string = 'Not authorized'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  /** @deprecated Use AppError with ErrorCode.EXTERNAL_SERVICE_ERROR instead */
  static externalService(
    service: string,
    message: string,
    context?: Record<string, any>
  ): AppError {
    return new AppError(`${service} error: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, 503, {
      service,
      ...context,
    });
  }

  /** @deprecated Use AppError with ErrorCode.INTERNAL_ERROR instead */
  static unknown(message: string, context?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500, context);
  }
}

/**
 * Map ErrorCode to legacy ErrorType for backward compatibility
 */
function errorCodeToType(code: ErrorCode): ErrorType {
  switch (code) {
    case ErrorCode.DATABASE_ERROR:
      return ErrorType.DATABASE;
    case ErrorCode.VALIDATION_ERROR:
      return ErrorType.VALIDATION;
    case ErrorCode.UNAUTHORIZED:
      return ErrorType.AUTHENTICATION;
    case ErrorCode.FORBIDDEN:
      return ErrorType.AUTHORIZATION;
    case ErrorCode.NOT_FOUND:
      return ErrorType.NOT_FOUND;
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
    case ErrorCode.SERVICE_UNAVAILABLE:
      return ErrorType.EXTERNAL_SERVICE;
    case ErrorCode.WEBSOCKET_ERROR:
      return ErrorType.WEBSOCKET;
    default:
      return ErrorType.UNKNOWN;
  }
}

/**
 * Legacy factory functions (for backward compatibility)
 * @deprecated Use AppError static methods instead
 */
export const errors = {
  database: (message: string, context?: Record<string, any>) => AppError.database(message, context),

  validation: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorCode.VALIDATION_ERROR, 400, context),

  notFound: (resource: string, id?: string) => AppError.notFoundLegacy(resource, id),

  authentication: (message: string = 'Authentication required') => AppError.authentication(message),

  authorization: (message: string = 'Not authorized') => AppError.authorization(message),

  externalService: (service: string, message: string, context?: Record<string, any>) =>
    AppError.externalService(service, message, context),

  websocket: (message: string, context?: Record<string, any>) =>
    new AppError(message, ErrorCode.WEBSOCKET_ERROR, 500, context),

  unknown: (message: string, context?: Record<string, any>) => AppError.unknown(message, context),
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
    const appError = new AppError(errorMessage, ErrorCode.INTERNAL_ERROR, 500, {
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
export function formatErrorResponse(
  error: Error,
  path: string = ''
): {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
  };
} {
  if (error instanceof AppError) {
    const response = error.toResponse(path);
    return {
      success: false,
      error: response.error,
    };
  }

  // Unknown error
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      path,
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
