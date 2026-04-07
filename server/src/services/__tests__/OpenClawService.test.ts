/**
 * OpenClawService Unit Tests
 *
 * Note: OpenClawService is a singleton instantiated at module load time,
 * which makes traditional mocking difficult. These tests focus on:
 * - Configuration validation
 * - Type safety
 * - Interface contracts
 * - Health check structure
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('OpenClawService - Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.OPENCLAW_MODE;
    delete process.env.OPENCLAW_GATEWAY_URL;
    delete process.env.OPENCLAW_VERIFICATION_TOKEN;
  });

  it('should export OpenClawService singleton', async () => {
    const { OpenClawService } = await import('../OpenClawService');
    expect(OpenClawService).toBeDefined();
    expect(typeof OpenClawService.sendMessage).toBe('function');
    expect(typeof OpenClawService.healthCheck).toBe('function');
  });

  it('should export OpenClawServiceClass for testing', async () => {
    const { OpenClawServiceClass } = await import('../OpenClawService');
    expect(OpenClawServiceClass).toBeDefined();
    expect(typeof OpenClawServiceClass).toBe('function');
  });

  it('should default to CLI mode when no mode specified', async () => {
    delete process.env.OPENCLAW_MODE;

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.mode).toBe('cli');
  });

  it('should accept CLI mode explicitly', async () => {
    process.env.OPENCLAW_MODE = 'cli';

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.mode).toBe('cli');
  });

  it('should accept HTTP mode with valid configuration', async () => {
    process.env.OPENCLAW_MODE = 'http';
    process.env.OPENCLAW_GATEWAY_URL = 'http://localhost:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test';

    const { OpenClawService } = await import('../OpenClawService');
    expect(OpenClawService).toBeDefined();
  });

  it('should accept REMOTE mode with valid configuration', async () => {
    process.env.OPENCLAW_MODE = 'remote';
    process.env.OPENCLAW_GATEWAY_URL = 'ws://127.0.0.1:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test';

    const { OpenClawService } = await import('../OpenClawService');
    expect(OpenClawService).toBeDefined();
  });

  it('should require OPENCLAW_VERIFICATION_TOKEN for HTTP mode', async () => {
    process.env.OPENCLAW_MODE = 'http';
    process.env.OPENCLAW_GATEWAY_URL = 'http://localhost:18789';
    delete process.env.OPENCLAW_VERIFICATION_TOKEN;

    await expect(import('../OpenClawService')).rejects.toThrow(
      'OPENCLAW_VERIFICATION_TOKEN required'
    );
  });

  it('should require OPENCLAW_GATEWAY_URL for HTTP mode', async () => {
    process.env.OPENCLAW_MODE = 'http';
    delete process.env.OPENCLAW_GATEWAY_URL;

    await expect(import('../OpenClawService')).rejects.toThrow('OPENCLAW_GATEWAY_URL required');
  });

  it('should reject invalid OPENCLAW_MODE', async () => {
    process.env.OPENCLAW_MODE = 'invalid';

    await expect(import('../OpenClawService')).rejects.toThrow('Invalid OPENCLAW_MODE');
  });
});

describe('OpenClawService - Type Contracts', () => {
  it('should have sendMessage method with correct signature', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    expect(OpenClawService.sendMessage).toBeDefined();
    expect(typeof OpenClawService.sendMessage).toBe('function');
    expect(OpenClawService.sendMessage.length).toBe(3); // message, agentId, sessionId
  });

  it('should have healthCheck method with correct signature', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    expect(OpenClawService.healthCheck).toBeDefined();
    expect(typeof OpenClawService.healthCheck).toBe('function');
    expect(OpenClawService.healthCheck.length).toBe(0);
  });

  it('healthCheck should return object with status field', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = await OpenClawService.healthCheck();

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.status).toBeDefined();
    expect(typeof result.status).toBe('string');
  });

  it('healthCheck should return object with mode field', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = await OpenClawService.healthCheck();

    expect(result.mode).toBeDefined();
    expect(typeof result.mode).toBe('string');
    expect(['cli', 'http', 'remote']).toContain(result.mode);
  });

  it('healthCheck should return object with timestamp', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = await OpenClawService.healthCheck();

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp)).toBeInstanceOf(Date);
  });
});

describe('OpenClawService - CLI Mode (Integration)', () => {
  beforeEach(() => {
    process.env.OPENCLAW_MODE = 'cli';
    delete process.env.OPENCLAW_GATEWAY_URL;
    delete process.env.OPENCLAW_VERIFICATION_TOKEN;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should have sendMessage that returns Promise', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = OpenClawService.sendMessage('test', 'test-agent', 'test-session');

    expect(result).toBeInstanceOf(Promise);
  });

  it('should have healthCheck that returns Promise', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = OpenClawService.healthCheck();

    expect(result).toBeInstanceOf(Promise);
  });
});

describe('OpenClawService - HTTP Mode (Integration)', () => {
  beforeEach(() => {
    process.env.OPENCLAW_MODE = 'http';
    process.env.OPENCLAW_GATEWAY_URL = 'http://localhost:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test-token';
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should have sendMessage that returns Promise', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = OpenClawService.sendMessage('test', 'test-agent', 'test-session');

    expect(result).toBeInstanceOf(Promise);
  });

  it('should have healthCheck that returns Promise', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = OpenClawService.healthCheck();

    expect(result).toBeInstanceOf(Promise);
  });
});

describe('OpenClawService - Remote Mode (Integration)', () => {
  beforeEach(() => {
    process.env.OPENCLAW_MODE = 'remote';
    process.env.OPENCLAW_GATEWAY_URL = 'ws://127.0.0.1:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test-token';
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should have sendMessage that returns Promise', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = OpenClawService.sendMessage('test', 'test-agent', 'test-session');

    expect(result).toBeInstanceOf(Promise);
  });

  it('healthCheck should include tunnel status for remote mode', async () => {
    const { OpenClawService } = await import('../OpenClawService');

    const result = await OpenClawService.healthCheck();

    expect(result.mode).toBe('remote');
    expect(result.tunnel).toBeDefined();
    expect(['connected', 'disconnected']).toContain(result.tunnel);
  });
});
