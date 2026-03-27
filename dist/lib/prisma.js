import { PrismaClient } from '@prisma/client';
// Initialize Prisma with singleton pattern
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        datasourceUrl: process.env.DATABASE_URL,
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
//# sourceMappingURL=prisma.js.map