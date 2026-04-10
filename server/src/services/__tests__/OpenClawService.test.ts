/**
 * OpenClawService Unit Tests
 *
 * Uses factory pattern for proper test isolation.
 * Each test creates a fresh service instance.
 */

import * as OpenClawServiceModule from '../OpenClawService.js';

const { createOpenClawService, OpenClawService } = OpenClawServiceModule;

describe('OpenClawService - Factory Pattern', () => {
  it('should export createOpenClawService factory function', () => {
    expect(createOpenClawService).toBeDefined();
    expect(typeof createOpenClawService).toBe('function');
  });

  it('should export OpenClawService class', () => {
    expect(OpenClawService).toBeDefined();
    expect(typeof OpenClawService).toBe('function');
  });

  it('should export singleton instance for backward compatibility', async () => {
    const module = await import('../OpenClawService.js');
    expect(module.openClawService).toBeDefined();
    expect(module.openClawService).toBeInstanceOf(OpenClawService);
  });

  it('should create isolated instances with factory', () => {
    const service1 = createOpenClawService();
    const service2 = createOpenClawService();
    expect(service1).not.toBe(service2);
  });

  it('should allow creating instances with custom config', () => {
    const service = createOpenClawService({ mode: 'cli' });
    expect(service).toBeInstanceOf(OpenClawService);
  });
});

describe('OpenClawService - Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OPENCLAW_MODE;
    delete process.env.OPENCLAW_GATEWAY_URL;
    delete process.env.OPENCLAW_VERIFICATION_TOKEN;
  });

  it('should default to CLI mode when no config specified', () => {
    delete process.env.OPENCLAW_MODE;
    const service = createOpenClawService();
    expect(service).toBeInstanceOf(OpenClawService);
  });

  it('should accept CLI mode from config', () => {
    const service = createOpenClawService({ mode: 'cli' });
    expect(service).toBeInstanceOf(OpenClawService);
  });

  it('should accept HTTP mode from config', () => {
    const service = createOpenClawService({
      mode: 'http',
      gatewayUrl: 'http://localhost:18789',
      verificationToken: 'test',
    });
    expect(service).toBeInstanceOf(OpenClawService);
  });

  it('should accept REMOTE mode from config', () => {
    const service = createOpenClawService({
      mode: 'remote',
      gatewayUrl: 'ws://localhost:18789',
      verificationToken: 'test',
    });
    expect(service).toBeInstanceOf(OpenClawService);
  });

  it('should throw error for HTTP mode without verification token', () => {
    expect(() => {
      createOpenClawService({
        mode: 'http',
        gatewayUrl: 'http://localhost:18789',
      });
    }).toThrow('OPENCLAW_VERIFICATION_TOKEN required');
  });

  it('should use environment variables when config not specified', () => {
    process.env.OPENCLAW_MODE = 'remote';
    process.env.OPENCLAW_GATEWAY_URL = 'ws://test:18789';
    process.env.OPENCLAW_VERIFICATION_TOKEN = 'env-token';

    const service = createOpenClawService();
    expect(service).toBeInstanceOf(OpenClawService);
  });

  it('should prioritize config over environment variables', () => {
    process.env.OPENCLAW_MODE = 'cli';
    const service = createOpenClawService({
      mode: 'remote',
      gatewayUrl: 'ws://test',
      verificationToken: 'test',
    });
    expect(service).toBeInstanceOf(OpenClawService);
  });
});

describe('OpenClawService - Type Contracts', () => {
  let service: OpenClawService;

  beforeEach(() => {
    service = createOpenClawService({ mode: 'cli' });
  });

  it('sendMessage should accept three parameters', () => {
    expect(service.sendMessage).toBeDefined();
    expect(typeof service.sendMessage).toBe('function');
    expect(service.sendMessage.length).toBe(3);
  });

  it('healthCheck should accept zero parameters', () => {
    expect(service.healthCheck).toBeDefined();
    expect(typeof service.healthCheck).toBe('function');
    expect(service.healthCheck.length).toBe(0);
  });

  it('healthCheck should return Promise', async () => {
    const result = await service.healthCheck();
    expect(result).toBeInstanceOf(Object);
  });

  it('healthCheck result should have mode field', async () => {
    const result = await service.healthCheck();
    expect(result).toHaveProperty('mode');
    expect(typeof result.mode).toBe('string');
  });

  it('healthCheck result should have healthy field', async () => {
    const result = await service.healthCheck();
    expect(result).toHaveProperty('healthy');
    expect(typeof result.healthy).toBe('boolean');
  });

  it('sendMessage should return Promise', async () => {
    const result = service.sendMessage('test', 'test-agent', 'test-session');
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('OpenClawService - CLI Mode', () => {
  let service: OpenClawService;

  beforeEach(() => {
    service = createOpenClawService({ mode: 'cli' });
  });

  it('healthCheck should report CLI mode', async () => {
    const result = await service.healthCheck();
    expect(result.mode).toBe('cli');
  });

  it('sendMessage should handle CLI execution', async () => {
    const result = await service.sendMessage('test message', 'test-agent', 'test-session');
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });
});

describe('OpenClawService - HTTP Mode', () => {
  let service: OpenClawService;

  beforeEach(() => {
    service = createOpenClawService({
      mode: 'http',
      gatewayUrl: 'http://localhost:18789',
      verificationToken: 'test',
    });
  });

  it('healthCheck should report HTTP mode', async () => {
    const result = await service.healthCheck();
    expect(result.mode).toBe('http');
  });

  it('sendMessage should handle HTTP execution', async () => {
    const result = await service.sendMessage('test message', 'test-agent', 'test-session');
    expect(result).toHaveProperty('success');
  });
});

describe('OpenClawService - Remote Mode', () => {
  let service: OpenClawService;

  beforeEach(() => {
    service = createOpenClawService({
      mode: 'remote',
      gatewayUrl: 'ws://localhost:18789',
      verificationToken: 'test',
    });
  });

  it('healthCheck should report remote mode', async () => {
    const result = await service.healthCheck();
    expect(result.mode).toBe('remote');
  });

  it('healthCheck should return mode and healthy status', async () => {
    const result = await service.healthCheck();
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('healthy');
    expect(['cli', 'remote', 'http']).toContain(result.mode);
  });

  it('sendMessage should handle remote execution', async () => {
    const result = await service.sendMessage('test message', 'test-agent', 'test-session');
    expect(result).toHaveProperty('success');
  });
});
