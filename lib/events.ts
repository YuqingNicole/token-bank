import { redis } from '@/lib/redis';

export type EventType =
  | 'key.created'
  | 'key.deleted'
  | 'proxy.success'
  | 'quota.exceeded'
  | 'key.expired'
  | 'key.invalid';

export interface VaultEvent {
  type: EventType;
  subKey: string;   // last 8 chars only
  vendor: string;
  group: string;
  name: string;
  timestamp: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

const EVENTS_PREFIX = 'vault:events:';
const MAX_PER_DAY = 5000;
const TTL_SECONDS = 30 * 24 * 3600; // 30 days

function todayKey(): string {
  return EVENTS_PREFIX + new Date().toISOString().slice(0, 10);
}

function dateKey(date: string): string {
  return EVENTS_PREFIX + date;
}

export async function logEvent(event: VaultEvent): Promise<void> {
  try {
    const key = todayKey();
    await redis.lpush(key, JSON.stringify(event));
    await redis.ltrim(key, 0, MAX_PER_DAY - 1);
    await redis.expire(key, TTL_SECONDS);
  } catch {
    // non-blocking — never throw
  }
}

/** Get recent events across multiple days. Default: last 7 days, max `limit` entries. */
export async function getEvents(limit = 100, days = 7): Promise<VaultEvent[]> {
  try {
    const results: VaultEvent[] = [];
    const now = new Date();

    for (let d = 0; d < days && results.length < limit; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const key = dateKey(date.toISOString().slice(0, 10));
      const needed = limit - results.length;
      const raw = await redis.lrange<string>(key, 0, needed - 1);
      if (!raw || raw.length === 0) continue;
      for (const r of raw) {
        try {
          results.push(JSON.parse(r) as VaultEvent);
        } catch { /* skip malformed */ }
        if (results.length >= limit) break;
      }
    }

    return results;
  } catch {
    return [];
  }
}
