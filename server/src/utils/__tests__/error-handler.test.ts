import {
  AppError,
  ErrorType,
  ErrorCode,
  errors,
  safeExecute,
  formatErrorResponse,
  logError,
} from '../error-handler';

describe('AppError', () => {
  it('should create an error with default values', () => {
    const error = new AppError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.type).toBe(ErrorType.UNKNOWN);
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should create an error with custom values', () => {
    const error = new AppError('Custom error', ErrorCode.VALIDATION_ERROR, 400, { field: 'email' });

    expect(error.message).toBe('Custom error');
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.type).toBe(ErrorType.VALIDATION);
    expect(error.statusCode).toBe(400);
    expect(error.context).toEqual({ field: 'email' });
  });

  it('should maintain stack trace', () => {
    const error = new AppError('Stack test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('error-handler.test.ts');
  });
});

describe('Error Factory Functions', () => {
  it('should create database error', () => {
    const error = errors.database('DB failed', { query: 'SELECT *' });

    expect(error.type).toBe(ErrorType.DATABASE);
    expect(error.statusCode).toBe(500);
    expect(error.context).toEqual({ query: 'SELECT *' });
  });

  it('should create validation error', () => {
    const error = errors.validation('Invalid email', { field: 'email' });

    expect(error.type).toBe(ErrorType.VALIDATION);
    expect(error.statusCode).toBe(400);
  });

  it('should create not found error', () => {
    const error = errors.notFound('User', '123');

    expect(error.type).toBe(ErrorType.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('User not found: 123');
  });

  it('should create authentication error', () => {
    const error = errors.authentication();

    expect(error.type).toBe(ErrorType.AUTHENTICATION);
    expect(error.statusCode).toBe(401);
  });

  it('should create authorization error', () => {
    const error = errors.authorization('Not allowed');

    expect(error.type).toBe(ErrorType.AUTHORIZATION);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Not allowed');
  });

  it('should create external service error', () => {
    const error = errors.externalService('OpenClaw', 'Timeout', { timeout: 30000 });

    expect(error.type).toBe(ErrorType.EXTERNAL_SERVICE);
    expect(error.statusCode).toBe(503);
    expect(error.message).toContain('OpenClaw');
  });

  it('should create websocket error', () => {
    const error = errors.websocket('Connection failed');

    expect(error.type).toBe(ErrorType.WEBSOCKET);
    expect(error.statusCode).toBe(500);
  });
});

describe('safeExecute', () => {
  it('should return result on success', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await safeExecute(operation, 'Failed');

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw AppError on failure', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Test error'));

    await expect(safeExecute(operation, 'Operation failed', { userId: '123' })).rejects.toThrow(
      AppError
    );

    await expect(
      safeExecute(operation, 'Operation failed', { userId: '123' })
    ).rejects.toMatchObject({
      message: 'Operation failed',
      type: ErrorType.UNKNOWN,
      context: { originalError: 'Test error', userId: '123' },
    });
  });

  it('should rethrow AppError without wrapping', async () => {
    const appError = errors.validation('Already an AppError');
    const operation = vi.fn().mockRejectedValue(appError);

    await expect(safeExecute(operation, 'Wrapper message')).rejects.toBe(appError);
  });
});

describe('formatErrorResponse', () => {
  it('should format AppError correctly', () => {
    const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR, 400, { field: 'email' });

    const response = formatErrorResponse(error);

    expect(response).toEqual({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Test error',
        details: { field: 'email' },
        timestamp: error.timestamp.toISOString(),
        path: '',
      },
    });
  });

  it('should format unknown error correctly', () => {
    const error = new Error('Plain error');

    const response = formatErrorResponse(error);

    expect(response).toEqual({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Plain error',
        timestamp: expect.any(String),
        path: '',
      },
    });
  });
});

describe('logError', () => {
  it('should log error with context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
    const error = new Error('Test error');

    logError(error, {
      service: 'MessageService',
      operation: 'sendMessage',
      userId: 'user123',
      requestId: 'req456',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ErrorHandler]',
      expect.objectContaining({
        service: 'MessageService',
        operation: 'sendMessage',
        error: expect.objectContaining({
          name: 'Error',
          message: 'Test error',
        }),
        context: expect.objectContaining({
          userId: 'user123',
          requestId: 'req456',
        }),
      })
    );

    consoleSpy.mockRestore();
  });
});
