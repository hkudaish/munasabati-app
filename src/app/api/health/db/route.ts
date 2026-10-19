import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await checkDatabaseHealth();
  const status = health.isConnected ? 'connected' : 'offline_fallback';
  const timestamp = new Date().toISOString();
  // Public endpoint: expose infrastructure detail only outside production.
  const body = process.env.NODE_ENV === 'production'
    ? { status, timestamp }
    : { status, provider: 'PostgreSQL (Prisma 6)', details: health.message, latencyMs: health.latencyMs ?? null, timestamp };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
