import { PrismaClient } from '@prisma/client';
import { getConnectionString } from '@netlify/database';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  databaseUrl: string | undefined;
};

function databaseClient() {
  let connection = process.env.DATABASE_URL;
  // Resolve inside the request: Netlify supplies credentials for its current DB branch.
  try { connection = getConnectionString(); } catch { /* Local PostgreSQL uses DATABASE_URL. */ }
  if (connection) {
    const url = new URL(connection);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '2');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    connection = url.toString();
  }
  if (!globalForPrisma.prisma || globalForPrisma.databaseUrl !== connection) {
    globalForPrisma.prisma = new PrismaClient({
    ...(connection ? { datasourceUrl: connection } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    globalForPrisma.databaseUrl = connection;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const client = databaseClient();
    const value = Reflect.get(client, key, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
