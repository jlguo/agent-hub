/**
 * E2E Test Database Setup Script
 *
 * Creates isolated test database and resets state before each E2E test
 * Run this before E2E tests to ensure clean state
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const TEST_DB_PATH = path.join(__dirname, '../../prisma/test.db');
const BACKUP_PATH = path.join(__dirname, '../../prisma/test.db.backup');

/**
 * Reset test database to clean state
 * Call this in test.beforeEach() hook
 */
export async function resetTestDatabase(): Promise<void> {
  console.log('🔄 Resetting test database...');

  try {
    // Backup current test DB if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.copyFileSync(TEST_DB_PATH, BACKUP_PATH);
    }

    // Delete all test data (in order to respect foreign keys)
    await prisma.message.deleteMany({});
    await prisma.discussion.deleteMany({});
    await prisma.relationship.deleteMany({});
    await prisma.agent.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.session.deleteMany({});

    console.log('✅ Test database cleaned');

    // Optionally: Seed with minimal test data
    await seedTestDatabase();
  } catch (error) {
    console.error('❌ Error resetting test database:', error);
    throw error;
  }
}

/**
 * Seed test database with minimal required data
 */
async function seedTestDatabase(): Promise<void> {
  console.log('🌱 Seeding test database...');

  try {
    // Create test room
    const testRoom = await prisma.room.create({
      data: {
        name: 'Test Room',
        externalChatId: 'test-chat-id',
        settings: '{}',
      },
    });

    console.log(`✅ Created test room: ${testRoom.id}`);

    // Create test agents
    const agents = await Promise.all([
      prisma.agent.create({
        data: {
          roomId: testRoom.id,
          name: 'Test Dad',
          role: 'father',
          avatar: '👨',
          talkativeness: 7,
          empathy: 6,
          curiosity: 5,
        },
      }),
      prisma.agent.create({
        data: {
          roomId: testRoom.id,
          name: 'Test Mom',
          role: 'mother',
          avatar: '👩',
          talkativeness: 8,
          empathy: 9,
          curiosity: 6,
        },
      }),
    ]);

    console.log(`✅ Created ${agents.length} test agents`);

    // Create relationships
    await prisma.relationship.create({
      data: {
        agentAId: agents[0].id,
        agentBId: agents[1].id,
        type: 'spouse',
        strength: 90,
      },
    });

    console.log('✅ Test database seeded');
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
    throw error;
  }
}

/**
 * Initialize test database (create schema if needed)
 * Call this once before running E2E tests
 */
export async function initializeTestDatabase(): Promise<void> {
  console.log('🔧 Initializing test database...');

  try {
    // Check if database exists
    if (!fs.existsSync(TEST_DB_PATH)) {
      console.log('📁 Creating test database file...');
      fs.writeFileSync(TEST_DB_PATH, '');
    }

    // Run migrations on test database
    console.log('📦 Running database migrations...');
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: `file:${TEST_DB_PATH}`,
      },
      stdio: 'inherit',
    });

    console.log('✅ Test database initialized');
  } catch (error) {
    console.error('❌ Error initializing test database:', error);
    throw error;
  }
}

/**
 * Cleanup test database after tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  console.log('🧹 Cleaning up test database...');

  try {
    await prisma.message.deleteMany({});
    await prisma.discussion.deleteMany({});
    await prisma.relationship.deleteMany({});
    await prisma.agent.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.session.deleteMany({});

    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get test database URL
 */
export function getTestDatabaseUrl(): string {
  return `file:${TEST_DB_PATH}`;
}

// If run directly, initialize the database
if (require.main === module) {
  initializeTestDatabase()
    .then(() => {
      console.log('✅ Test database ready for E2E tests');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to initialize test database:', error);
      process.exit(1);
    });
}
