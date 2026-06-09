import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Prisma-Client als Singleton. Prisma verwendet ausschliesslich parametrisierte
 * Queries — Schutz vor SQL-Injection ist damit gegeben.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}
