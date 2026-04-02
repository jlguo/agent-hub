#!/usr/bin/env tsx
/**
 * Test Database Setup Script
 * Creates and migrates the test database
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DB_PATH = path.join(__dirname, '../prisma/test.db');

console.log('🔧 Setting up test database...');

// Remove existing test database
if (fs.existsSync(TEST_DB_PATH)) {
  console.log('🗑️  Removing existing test database');
  fs.unlinkSync(TEST_DB_PATH);
}

// Copy schema to test schema
const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const TEST_SCHEMA_PATH = path.join(__dirname, '../prisma/test.schema.prisma');

console.log('📋 Creating test schema');
let schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Replace database URL with test database
schema = schema.replace(
  /url\s*=\s*"file:.*\.db"/,
  'url = "file:./test.db"'
);

fs.writeFileSync(TEST_SCHEMA_PATH, schema);

// Run migrations on test database
console.log('🔄 Running Prisma migrations...');
try {
  execSync('npx prisma migrate dev --schema prisma/test.schema.prisma --skip-generate --skip-seed', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
  });
  
  // Generate Prisma client for test schema
  console.log('🔨 Generating Prisma client...');
  execSync('npx prisma generate --schema prisma/test.schema.prisma', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '../..'),
  });
  
  console.log('✅ Test database created successfully!');
  console.log(`📍 Location: ${TEST_DB_PATH}`);
} catch (error) {
  console.error('❌ Failed to setup test database');
  console.error(error);
  process.exit(1);
}
