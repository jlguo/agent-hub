#!/usr/bin/env tsx

/**
 * Test Rules Validation Script
 * 
 * Validates that code changes comply with test writing and maintenance rules.
 * Run this script in CI/CD pipeline or pre-commit hooks.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

// Validation checks
const checks: Array<{
  name: string;
  check: () => boolean | string;
  required: boolean;
}> = [
  {
    name: 'Coverage threshold met',
    check: () => {
      try {
        runCommand('npm run test:coverage:check');
        return true;
      } catch (error) {
        return 'Coverage threshold not met. Run `npm run test:coverage` to see details.';
      }
    },
    required: true,
  },
  {
    name: 'Test files exist for changed source files',
    check: () => {
      // Get changed files from git
      try {
        const changedFiles = runCommand('git diff --name-only HEAD')
          .split('\n')
          .filter((f) => f.trim() && f.endsWith('.ts'))
          .filter((f) => !f.includes('.test.ts') && !f.includes('.spec.ts'));

        const missingTests: string[] = [];

        for (const file of changedFiles) {
          // Skip non-source files
          if (file.includes('node_modules') || file.includes('dist')) {
            continue;
          }

          // Check if test file exists
          const testFile = file.replace('.ts', '.test.ts');
          const testPath = testFile.includes('src/')
            ? testFile.replace('src/', 'src/').replace('.ts', '/__tests__/' + testFile.split('/').pop())
            : testFile;

          if (!existsSync(testPath)) {
            // Check for integration test
            const integrationTest = `tests/integration/${file.replace('src/', '').replace('.ts', '.test.ts')}`;
            if (!existsSync(integrationTest)) {
              missingTests.push(file);
            }
          }
        }

        if (missingTests.length > 0) {
          return `Missing test files for: ${missingTests.join(', ')}`;
        }

        return true;
      } catch (error) {
        return 'Could not check changed files (not a git repository?)';
      }
    },
    required: true,
  },
  {
    name: 'Test naming convention followed',
    check: () => {
      const testFiles = runCommand('find . -name "*.test.ts" -o -name "*.spec.ts"')
        .split('\n')
        .filter((f) => f.trim() && !f.includes('node_modules'));

      const invalidNames: string[] = [];

      for (const file of testFiles) {
        try {
          const content = readFileSync(file, 'utf-8');
          const testMatches = content.matchAll(/it\(['"](.*?)['"]/g);
          
          for (const match of testMatches) {
            const testName = match[1];
            // Check if test name follows convention: should [behavior] when [condition]
            if (!testName.includes('should ')) {
              invalidNames.push(`${file}: "${testName}"`);
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      if (invalidNames.length > 0) {
        return `Invalid test names (must include 'should '): ${invalidNames.slice(0, 5).join(', ')}${invalidNames.length > 5 ? ` (+${invalidNames.length - 5} more)` : ''}`;
      }

      return true;
    },
    required: false, // Warning only for now
  },
  {
    name: 'No console.log in test files',
    check: () => {
      const testFiles = runCommand('find . -name "*.test.ts" -o -name "*.spec.ts"')
        .split('\n')
        .filter((f) => f.trim() && !f.includes('node_modules'));

      const filesWithLogs: string[] = [];

      for (const file of testFiles) {
        try {
          const content = readFileSync(file, 'utf-8');
          if (content.includes('console.log')) {
            filesWithLogs.push(file);
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      if (filesWithLogs.length > 0) {
        return `console.log found in test files: ${filesWithLogs.slice(0, 3).join(', ')}${filesWithLogs.length > 3 ? ` (+${filesWithLogs.length - 3} more)` : ''}`;
      }

      return true;
    },
    required: false, // Warning only
  },
  {
    name: 'No test.skip() in main branch',
    check: () => {
      try {
        const skippedTests = runCommand('grep -r "test.skip\\|describe.skip" --include="*.test.ts" --include="*.spec.ts" .');
        if (skippedTests.trim()) {
          return `Skipped tests found:\n${skippedTests.split('\n').slice(0, 5).join('\n')}`;
        }
        return true;
      } catch (error) {
        return true; // grep returns non-zero if no matches, which is good
      }
    },
    required: true,
  },
  {
    name: 'tests/README.md exists',
    check: () => {
      if (!existsSync('tests/README.md')) {
        return 'tests/README.md not found. Please create test documentation.';
      }
      return true;
    },
    required: true,
  },
];

// Main validation
async function main() {
  log('🔍 Validating test rules...\n', 'blue');

  let allPassed = true;
  const warnings: string[] = [];

  for (const { name, check, required } of checks) {
    process.stdout.write(`Checking: ${name}... `);
    
    try {
      const result = check();
      
      if (result === true) {
        log('✅ PASS', 'green');
      } else {
        if (required) {
          log('❌ FAIL', 'red');
          log(`   ${result}`, 'yellow');
          allPassed = false;
        } else {
          log('⚠️  WARNING', 'yellow');
          warnings.push(result as string);
        }
      }
    } catch (error: any) {
      log('❌ ERROR', 'red');
      log(`   ${error.message}`, 'yellow');
      if (required) {
        allPassed = false;
      }
    }
  }

  console.log();

  if (warnings.length > 0) {
    log('Warnings:', 'yellow');
    warnings.forEach((w) => log(`  - ${w}`, 'yellow'));
    console.log();
  }

  if (allPassed) {
    log('✅ All test rules validated successfully!', 'green');
    process.exit(0);
  } else {
    log('❌ Test validation failed. Please fix the issues above.', 'red');
    log('\nSee docs/skills/test-writing-rules/SKILL.md for details.', 'blue');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
