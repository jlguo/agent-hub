#!/usr/bin/env tsx
/**
 * Coverage Threshold Checker
 * Validates that test coverage meets minimum requirements
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const COVERAGE_FILE = join(process.cwd(), 'coverage/unit/coverage-summary.json');
const THRESHOLDS = {
  lines: 5,
  statements: 5,
  functions: 15,
  branches: 4,
};

interface CoverageSummary {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}

const checkCoverage = () => {
  try {
    const data: CoverageSummary = JSON.parse(readFileSync(COVERAGE_FILE, 'utf-8'));
    const { total } = data;

    const checks = [
      { name: 'Lines', actual: total.lines.pct, threshold: THRESHOLDS.lines },
      { name: 'Statements', actual: total.statements.pct, threshold: THRESHOLDS.statements },
      { name: 'Functions', actual: total.functions.pct, threshold: THRESHOLDS.functions },
      { name: 'Branches', actual: total.branches.pct, threshold: THRESHOLDS.branches },
    ];

    let allPassed = true;

    console.log('📊 Coverage Report\n');
    console.log('Metric\t\tRequired\tActual\t\tStatus');
    console.log('───────\t\t────────\t──────\t\t──────');

    checks.forEach((check) => {
      const passed = check.actual >= check.threshold;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${check.name}\t\t${check.threshold}%\t\t${check.actual.toFixed(1)}%\t\t${status}`
      );

      if (!passed) allPassed = false;
    });

    console.log('');

    if (!allPassed) {
      console.error('❌ Coverage thresholds not met!');
      console.error('\n💡 Tip: Run tests with coverage to see detailed report:');
      console.error('   npm run test:coverage\n');
      process.exit(1);
    } else {
      console.log('✅ All coverage thresholds met!');
      process.exit(0);
    }
  } catch (error) {
    console.error(
      '❌ Error reading coverage file:',
      error instanceof Error ? error.message : error
    );
    console.error('\n💡 Tip: Generate coverage first:');
    console.error('   npm run test:coverage\n');
    process.exit(1);
  }
};

checkCoverage();
