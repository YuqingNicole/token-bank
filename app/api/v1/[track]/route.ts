import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

type RouteContext = {
  params: Promise<{ track: string }>
}

export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  const { track } = await context.params;
  const subKey = req.headers.get('x-api-key');
  const MASTER_KEY = process.env.CLAUDE_MASTER_KEY;

  if (!subKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
  }

  // 1. 从 Redis 校验该 subKey 是否存在且属于该 track
  const keyDataStr = await redis.hget('vault_subkeys', subKey);
  if (!keyDataStr) {
    return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });
  }

  const keyData = typeof keyDataStr === 'string' ? JSON.parse(keyDataStr) : keyDataStr;
  if (keyData.track !== track) {
    return NextResponse.json({ error: 'Key mismatch for this track' }, { status: 403 });
  }

  try {
    const bodyText = await req.text();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MASTER_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: bodyText
    });

    const data = await response.json();

    // 2. 如果请求成功，更新用量统计
    if (response.ok) {
      keyData.usage = (keyData.usage || 0) + 1;
      keyData.lastUsed = new Date().toISOString();
      await redis.hset('vault_subkeys', { [subKey]: JSON.stringify(keyData) });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Neurolink Error' }, { status: 500 });
  }
}
