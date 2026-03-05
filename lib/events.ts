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

const EVENTS_KEY = 'vault:events';
const MAX_EVENTS = 500;

export async function logEvent(event: VaultEvent): Promise<void> {
  try {
    await redis.lpush(EVENTS_KEY, JSON.stringify(event));
    await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  } catch {
    // non-blocking — never throw
  }
}

export async function getEvents(limit = 100): Promise<VaultEvent[]> {
  try {
    const raw = await redis.lrange<string>(EVENTS_KEY, 0, limit - 1);
    return (raw ?? []).map((r) => {
      try { return JSON.parse(r) as VaultEvent; } catch { return null; }
    }).filter(Boolean) as VaultEvent[];
  } catch {
    return [];
  }
}
