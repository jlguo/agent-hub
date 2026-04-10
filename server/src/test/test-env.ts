/**
 * Test environment variables
 * Loaded before all tests
 */

// Set DATABASE_URL to point to root prisma directory
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:../prisma/dev.db';
