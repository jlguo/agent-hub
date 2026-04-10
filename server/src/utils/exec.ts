/**
 * Async exec wrapper for Node.js
 *
 * Provides promise-based child_process execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Promisified exec function
 */
export const execAsync = promisify(exec);

/**
 * Execute command with strict timeout
 *
 * @param command Command to execute
 * @param options Exec options including timeout
 * @returns Promise resolving to stdout/stderr
 */
export async function executeCommand(
  command: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout || 30000;

    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout.trim(), stderr });
      }
    });

    // Enforce timeout
    setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });
}
