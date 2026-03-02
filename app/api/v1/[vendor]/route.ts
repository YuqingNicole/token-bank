import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { isValidVendor } from '@/lib/vendors';
import { buildUpstreamRequest } from '@/lib/proxy';

type RouteContext = {
  params: Promise<{ vendor: string }>;
};

const parseKeyRecord = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Failed to parse key record', error);
      return null;
    }
  }
  return value;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const { vendor } = await context.params;

  if (!isValidVendor(vendor)) {
    return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 });
  }

  const subKey = req.headers.get('x-api-key');
  const masterKey = process.env[`${vendor.toUpperCase()}_MASTER_KEY`];

  if (!masterKey) {
    console.error(`Missing ${vendor.toUpperCase()}_MASTER_KEY environment variable`);
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }

  if (!subKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
  }

  try {
    const keyDataStr = await redis.hget('vault:subkeys', subKey);
    const keyData = parseKeyRecord(keyDataStr);

    if (!keyData || (keyData as { vendor?: string }).vendor !== vendor) {
      return NextResponse.json({ error: 'Invalid or mismatched key' }, { status: 403 });
    }

    const rawBody = await req.text();
    const upstream = buildUpstreamRequest(vendor, masterKey, rawBody);

    const response = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body: upstream.body,
    });

    const data = await response.json();

    if (response.ok) {
      const now = new Date().toISOString();
      const updated = {
        ...keyData,
        usage: ((keyData as { usage?: number }).usage || 0) + 1,
        lastUsed: now,
      };
      await redis.hset('vault:subkeys', { [subKey]: JSON.stringify(updated) });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy request failed', error);
    return NextResponse.json({ error: 'Proxy Error' }, { status: 500 });
  }
}
