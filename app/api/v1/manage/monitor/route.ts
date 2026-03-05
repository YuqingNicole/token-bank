import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getEvents } from '@/lib/events';
import type { SubKeyData } from '@/lib/types';

function parseSafe(v: unknown): SubKeyData | null {
  if (!v) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v as SubKeyData;
}

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get('group') ?? 'botearn';
  const eventLimit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10), 500);

  const [rawKeys, events] = await Promise.all([
    redis.hgetall<Record<string, string>>('vault:subkeys'),
    getEvents(eventLimit),
  ]);

  // Filter keys by group
  const keys: (SubKeyData & { key: string })[] = [];
  for (const [k, v] of Object.entries(rawKeys ?? {})) {
    const d = parseSafe(v);
    if (!d || d.group !== group) continue;
    keys.push({ ...d, key: k });
  }

  const now = new Date();
  let totalTokens = 0, totalQuota = 0, totalCalls = 0, totalCostUsd = 0;
  let exhausted = 0, active = 0, noQuota = 0;

  for (const k of keys) {
    const used = (k.inputTokens ?? 0) + (k.outputTokens ?? 0);
    totalTokens += used;
    totalCalls += k.usage ?? 0;
    totalCostUsd += k.costUsd ?? 0;
    if (k.totalQuota != null) totalQuota += k.totalQuota;

    if (k.totalQuota == null) { noQuota++; }
    else if (used >= k.totalQuota) { exhausted++; }
    else { active++; }
  }

  const keyList = keys.map((k) => {
    const used = (k.inputTokens ?? 0) + (k.outputTokens ?? 0);
    return {
      key: k.key,
      name: k.name,
      vendor: k.vendor,
      usage: k.usage ?? 0,
      inputTokens: k.inputTokens ?? 0,
      outputTokens: k.outputTokens ?? 0,
      costUsd: k.costUsd ?? 0,
      totalQuota: k.totalQuota,
      usedTokens: used,
      quotaPct: k.totalQuota != null && k.totalQuota > 0 ? Math.min(1, used / k.totalQuota) : null,
      status: k.totalQuota == null ? 'no-quota' : used >= k.totalQuota ? 'exhausted' : 'active',
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
      lastUsedHours: k.lastUsed
        ? (now.getTime() - new Date(k.lastUsed).getTime()) / (1000 * 60 * 60)
        : null,
    };
  }).sort((a, b) => (b.lastUsed ?? '').localeCompare(a.lastUsed ?? ''));

  // Filter events by group
  const groupEvents = events.filter((e) => e.group === group);

  return NextResponse.json({
    group,
    summary: {
      totalKeys: keys.length,
      active,
      exhausted,
      noQuota,
      totalCalls,
      totalTokens,
      totalQuota,
      totalCostUsd,
      quotaUtilizationPct: totalQuota > 0 ? Math.min(1, totalTokens / totalQuota) : null,
    },
    keys: keyList,
    events: groupEvents,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
