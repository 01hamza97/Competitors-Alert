import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

export const prisma =
  (globalForPrisma.prisma?.scraperRunLog ? globalForPrisma.prisma : null) ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
