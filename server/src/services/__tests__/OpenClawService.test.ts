/**
 * OpenClawService Unit Tests
 *
 * Integration-style unit tests for OpenClawService
 * Tests the singleton instance with mocked dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { exec } from 'child_process';
import fetch from 'node-fetch';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Suppress console
const suppressConsole = () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('OpenClawService - CLI Mode', () => {
  beforeEach(() => {
    suppressConsole();
    process.env.OPENCLAW_MODE = 'cli';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should send message via CLI', async () => {
    mockExec.mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'Test response', stderr: '' });
      return {} as any;
    });

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.sendMessage('Test', 'family-mom', 'session1');

    expect(result.content).toBe('Test response');
    expect(mockExec).toHaveBeenCalled();
  });

  it('should handle CLI errors', async () => {
    mockExec.mockImplementation((cmd: any, cb: any) => {
      cb(new Error('CLI failed'));
      return {} as any;
    });

    const { OpenClawService } = await import('../OpenClawService');

    await expect(OpenClawService.sendMessage('Test', 'family-mom', 'session1')).rejects.toThrow(
      'CLI failed'
    );
  });

  it('should perform health check', async () => {
    mockExec.mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
    });

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.status).toBe('healthy');
    expect(result.mode).toBe('cli');
  });
});

describe('OpenClawService - HTTP Mode', () => {
  beforeEach(() => {
    suppressConsole();
    process.env.OPENCLAW_MODE = 'http';
    process.env.OPENCLAW_GATEWAY_URL = 'http://localhost:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test-token';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should send message via HTTP', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'HTTP response' }),
    } as any);

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.sendMessage('Test', 'family-mom', 'session1');

    expect(result.content).toBe('HTTP response');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    } as any);

    const { OpenClawService } = await import('../OpenClawService');

    await expect(OpenClawService.sendMessage('Test', 'family-mom', 'session1')).rejects.toThrow(
      'HTTP 500'
    );
  });

  it('should perform health check (HTTP always healthy)', async () => {
    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.status).toBe('healthy');
    expect(result.mode).toBe('http');
  });
});

describe('OpenClawService - Remote Mode', () => {
  beforeEach(() => {
    suppressConsole();
    process.env.OPENCLAW_MODE = 'remote';
    process.env.OPENCLAW_GATEWAY_URL = 'ws://127.0.0.1:18789';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should perform remote health check successfully', async () => {
    mockExec.mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
    });

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.status).toBe('healthy');
    expect(result.mode).toBe('remote');
    expect(result.tunnel).toBe('connected');
  });

  it('should detect disconnected tunnel', async () => {
    mockExec.mockImplementation((cmd: any, cb: any) => {
      cb(new Error('Connection refused'));
      return {} as any;
    });

    const { OpenClawService } = await import('../OpenClawService');
    const result = await OpenClawService.healthCheck();

    expect(result.status).toBe('unhealthy');
    expect(result.tunnel).toBe('disconnected');
  });
});

describe('OpenClawService - Configuration', () => {
  beforeEach(() => {
    suppressConsole();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should default to CLI mode', async () => {
    delete process.env.OPENCLAW_MODE;
    const { OpenClawService } = await import('../OpenClawService');
    expect(OpenClawService).toBeDefined();
  });

  it('should require token for HTTP mode', async () => {
    process.env.OPENCLAW_MODE = 'http';
    delete process.env.OPENCLAW_VERIFICATION_TOKEN;

    await expect(import('../OpenClawService')).rejects.toThrow(
      'OPENCLAW_VERIFICATION_TOKEN required'
    );
  });

  it('should accept HTTP mode with token', async () => {
    process.env.OPENCLAW_MODE = 'http';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'test';

    const { OpenClawService } = await import('../OpenClawService');
    expect(OpenClawService).toBeDefined();
  });
});
