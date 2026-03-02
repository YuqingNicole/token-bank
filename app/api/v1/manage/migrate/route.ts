import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import type { SubKeyData } from '@/lib/types';

// One-time migration: vault_subkeys → vault:subkeys
// Adds vendor/group fields with defaults for existing keys
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret');
  const expectedSecret = process.env.MIGRATION_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const oldKeys = await redis.hgetall<Record<string, string>>('vault_subkeys');

    if (!oldKeys || Object.keys(oldKeys).length === 0) {
      return NextResponse.json({ message: 'No keys to migrate', migrated: 0 });
    }

    const migrated: string[] = [];
    const failed: string[] = [];

    for (const [key, rawValue] of Object.entries(oldKeys)) {
      try {
        let parsed: Record<string, unknown>;
        if (typeof rawValue === 'string') {
          parsed = JSON.parse(rawValue);
        } else {
          parsed = rawValue as Record<string, unknown>;
        }

        // Map old track field to vendor/group
        const track = typeof parsed.track === 'string' ? parsed.track : 'botearn';

        const newData: SubKeyData = {
          name: typeof parsed.name === 'string' ? parsed.name : 'Migrated Key',
          vendor: 'claude', // all old keys were claude
          group: track,
          usage: typeof parsed.usage === 'number' ? parsed.usage : 0,
          createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
          lastUsed: typeof parsed.lastUsed === 'string' ? parsed.lastUsed : null,
        };

        await redis.hset('vault:subkeys', { [key]: JSON.stringify(newData) });
        migrated.push(key);
      } catch (err) {
        console.error(`Failed to migrate key ${key}`, err);
        failed.push(key);
      }
    }

    return NextResponse.json({
      message: 'Migration complete',
      migrated: migrated.length,
      failed: failed.length,
      keys: migrated,
    });
  } catch (error) {
    console.error('Migration failed', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
