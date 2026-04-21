import { PrismaClient } from '@prisma/client';

// Initialize Prisma with singleton pattern for Docker environment
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:/app/prisma/dev.db',
      },
    },
    // Log errors
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
