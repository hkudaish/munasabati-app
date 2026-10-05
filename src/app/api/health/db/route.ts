import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/server-db';

export async function GET() {
  const health = await checkDatabaseHealth();
  return NextResponse.json({
    status: health.isConnected ? 'connected' : 'offline_fallback',
    provider: 'PostgreSQL (Prisma 6)',
    details: health.message,
    latencyMs: health.latencyMs ?? null,
    timestamp: new Date().toISOString(),
  });
}
