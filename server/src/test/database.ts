/**
 * Test Database Utilities
 *
 * Provides isolated test database setup and cleanup for each test suite.
 * Ensures tests don't interfere with each other by using separate test DB.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrismaClient, Agent, Room, Relationship } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test database path (relative to project root)
const TEST_DB_PATH = '../prisma/test.db';
const SCHEMA_PATH = '../prisma/schema.prisma';

/**
 * Create a fresh test database
 * Simplified for faster test initialization
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setupTestDatabase(): Promise<void> {
  try {
    console.log('📦 Setting up test database...');

    // Remove existing test database if it exists
    await execAsync(`rm -f ${TEST_DB_PATH}`);

    // Use db push instead of migrate for faster setup (schema only, no migration history)
    await execAsync(`DATABASE_URL=file:${TEST_DB_PATH} npx prisma db push --schema=${SCHEMA_PATH}`);

    console.log('✅ Test database created successfully');
  } catch (error: any) {
    console.error('❌ Failed to setup test database:', error.message);
    throw error;
  }
}

/**
 * Clean all data from test database (but keep schema)
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${TEST_DB_PATH}`,
        },
      },
    });

    // Delete all data in reverse order of dependencies (ignore errors if tables don't exist)
    /* eslint-disable no-empty */
    try {
      await prisma.message.deleteMany();
    } catch {}
    try {
      await prisma.discussion.deleteMany();
    } catch {}
    try {
      await prisma.relationship.deleteMany();
    } catch {}
    try {
      await prisma.agent.deleteMany();
    } catch {}
    try {
      await prisma.room.deleteMany();
    } catch {}
    try {
      await prisma.session.deleteMany();
    } catch {}
    /* eslint-enable no-empty */

    await prisma.$disconnect();

    console.log('🧹 Test database cleaned');
  } catch (error: any) {
    console.error('❌ Failed to cleanup test database:', error.message);
    throw error;
  }
}

/**
 * Get test database Prisma client
 */
export function getTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: `file:${TEST_DB_PATH}`,
      },
    },
  });
}

/**
 * Run a test with isolated database
 * Automatically cleans up after test completes
 */
export async function withTestDatabase<T>(testFn: () => Promise<T>): Promise<T> {
  await setupTestDatabase();

  try {
    const result = await testFn();
    await cleanupTestDatabase();
    return result;
  } catch (error) {
    await cleanupTestDatabase();
    throw error;
  }
}

/**
 * Seed test database with minimal required data
 */
export async function seedTestDatabase(seedData: {
  rooms?: Partial<Room>[];
  agents?: Partial<Agent>[];
  relationships?: Partial<Relationship>[];
}): Promise<void> {
  const prisma = getTestPrismaClient();

  try {
    // Seed rooms
    if (seedData.rooms) {
      for (const room of seedData.rooms) {
        await prisma.room.create({
          data: room as any, // Type assertion for flexibility
        });
      }
    }

    // Seed agents
    if (seedData.agents) {
      for (const agent of seedData.agents) {
        await prisma.agent.create({
          data: agent as any, // Type assertion for flexibility
        });
      }
    }

    // Seed relationships
    if (seedData.relationships) {
      for (const relationship of seedData.relationships) {
        await prisma.relationship.create({
          data: relationship as any, // Type assertion for flexibility
        });
      }
    }

    console.log('🌱 Test database seeded');
  } catch (error: any) {
    console.error('❌ Failed to seed test database:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
