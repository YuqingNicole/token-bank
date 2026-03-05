import { redis } from '@/lib/redis';

const YA_BASE = 'https://your-agent.cc';
const SYNC_KEY = 'vault:youragent:sync';

export interface YAKeyInfo {
  name: string;
  totalCostLimit: number;
  dailyCostLimit: number;
  totalCost: number;
  dailyCost: number;
  tokenLimit: number;
  expiresAt: string | null;
}

export interface YAUsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  allTokens: number;
}

export interface YARecentRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  cost: number;
  realCost: number;
}

export interface YASyncData {
  keyInfo: YAKeyInfo;
  total: YAUsageTotals;
  daily: YAUsageTotals;
  monthly: YAUsageTotals;
  recentRecords: YARecentRecord[];
  syncedAt: string;
}

export async function fetchYASync(masterKey: string): Promise<YASyncData> {
  const headers = { Authorization: `Bearer ${masterKey}` };

  const [kiRes, usageRes] = await Promise.all([
    fetch(`${YA_BASE}/api/v1/key-info`, { headers }),
    fetch(`${YA_BASE}/api/v1/usage`, { headers }),
  ]);

  if (!kiRes.ok) throw new Error(`key-info failed: ${kiRes.status}`);
  if (!usageRes.ok) throw new Error(`usage failed: ${usageRes.status}`);

  const kiData = await kiRes.json();
  const usageData = await usageRes.json();

  const ki = kiData.keyInfo || {};
  const usage = usageData.usage || ki.usage || {};

  const result: YASyncData = {
    keyInfo: {
      name: ki.name,
      totalCostLimit: ki.totalCostLimit || 0,
      dailyCostLimit: ki.dailyCostLimit || 0,
      totalCost: ki.totalCost || 0,
      dailyCost: ki.dailyCost || 0,
      tokenLimit: ki.tokenLimit || 0,
      expiresAt: ki.expiresAt || null,
    },
    total: usage.total || {},
    daily: usage.daily || {},
    monthly: usage.monthly || {},
    recentRecords: (usage.recentRecords || []).slice(0, 100),
    syncedAt: new Date().toISOString(),
  };

  await redis.set(SYNC_KEY, JSON.stringify(result));
  return result;
}

export async function getYASync(): Promise<YASyncData | null> {
  try {
    const raw = await redis.get<string>(SYNC_KEY);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw as YASyncData;
  } catch {
    return null;
  }
}
