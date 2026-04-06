/**
 * Test Utilities
 *
 * Common utilities for testing including mocking, assertions, and helpers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Mock OpenClawService for unit tests
 */
export class MockOpenClawService {
  private static mockResponse: string = 'Test agent response';
  private static shouldFail: boolean = false;
  private static responseDelay: number = 100;

  static setMockResponse(response: string): void {
    MockOpenClawService.mockResponse = response;
  }

  static setShouldFail(shouldFail: boolean): void {
    MockOpenClawService.shouldFail = shouldFail;
  }

  static setResponseDelay(delayMs: number): void {
    MockOpenClawService.responseDelay = delayMs;
  }

  static async sendMessage(_agentId: string, _message: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, MockOpenClawService.responseDelay));

    if (MockOpenClawService.shouldFail) {
      throw new Error('Mock OpenClaw failure');
    }

    return MockOpenClawService.mockResponse;
  }

  static async healthCheck(): Promise<{ status: string }> {
    return {
      status: MockOpenClawService.shouldFail ? 'error' : 'healthy',
    };
  }

  static reset(): void {
    MockOpenClawService.mockResponse = 'Test agent response';
    MockOpenClawService.shouldFail = false;
    MockOpenClawService.responseDelay = 100;
  }
}

/**
 * Mock FeishuService for unit tests
 */
export class MockFeishuService {
  private static sentMessages: Array<{ chatId: string; content: string }> = [];
  private static shouldFail: boolean = false;

  static getSentMessages(): Array<{ chatId: string; content: string }> {
    return [...MockFeishuService.sentMessages];
  }

  static setShouldFail(shouldFail: boolean): void {
    MockFeishuService.shouldFail = shouldFail;
  }

  static async sendMessage(chatId: string, content: string): Promise<void> {
    if (MockFeishuService.shouldFail) {
      throw new Error('Mock Feishu failure');
    }

    MockFeishuService.sentMessages.push({ chatId, content });
  }

  static reset(): void {
    MockFeishuService.sentMessages = [];
    MockFeishuService.shouldFail = false;
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Suppress console output during tests
 */
export function suppressConsole(): { restore: () => void } {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  return {
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

/**
 * Create a test agent data object
 */
export function createTestAgentData(overrides: Partial<any> = {}): any {
  return {
    id: `agent_${Date.now()}`,
    name: `Test Agent ${Date.now()}`,
    role: 'assistant',
    talkativeness: 5,
    empathy: 5,
    curiosity: 5,
    avatar: '🤖',
    ...overrides,
  };
}

/**
 * Create a test room data object
 */
export function createTestRoomData(overrides: Partial<any> = {}): any {
  return {
    id: `room_${Date.now()}`,
    name: `Test Room ${Date.now()}`,
    settings: '{}',
    ...overrides,
  };
}

/**
 * Assert that a function throws an error
 */
export async function expectToThrow(
  fn: () => Promise<unknown> | unknown,
  errorConstructor?: Function | string
): Promise<void> {
  try {
    await Promise.resolve(fn());
    throw new Error('Expected function to throw but it did not');
  } catch (error: unknown) {
    if (errorConstructor) {
      if (typeof errorConstructor === 'string') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes(errorConstructor)) {
          throw new Error(
            `Expected error message to include "${errorConstructor}" but got "${errorMessage}"`
          );
        }
      } else if (error instanceof ErrorConstructor) {
        throw new Error(
          `Expected error to be instance of ${errorConstructor.name} but got ${(error as Error).constructor.name}`
        );
      }
    }
  }
}
