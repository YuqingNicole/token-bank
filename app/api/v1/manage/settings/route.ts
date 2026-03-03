import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const SETTINGS_KEY = 'vault:settings';
const CACHE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  const raw = await redis.hgetall<Record<string, string>>(SETTINGS_KEY);
  const settings = {
    youagentBudgetUsd: raw?.youagentBudgetUsd != null ? parseFloat(raw.youagentBudgetUsd) : 20,
  };
  return NextResponse.json(settings, { headers: CACHE_HEADERS });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const updates: Record<string, string> = {};

  if (typeof body.youagentBudgetUsd === 'number' && body.youagentBudgetUsd >= 0) {
    updates.youagentBudgetUsd = String(body.youagentBudgetUsd);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  await redis.hset(SETTINGS_KEY, updates);
  return NextResponse.json({ ok: true });
}
