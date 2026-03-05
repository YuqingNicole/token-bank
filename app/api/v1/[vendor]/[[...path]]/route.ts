import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { isValidVendor } from '@/lib/vendors';
import { buildUpstreamRequest } from '@/lib/proxy';
import { extractTokenUsage, estimateVendorCostUsd, safeModelFromBody } from '@/lib/billing';
import { logEvent } from '@/lib/events';

type RouteContext = {
  params: Promise<{ vendor: string; path?: string[] }>;
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

function isStreaming(rawBody: string): boolean {
  try {
    return JSON.parse(rawBody)?.stream === true;
  } catch {
    return false;
  }
}

// Parse Anthropic SSE stream to extract token usage
async function extractTokensFromSSE(stream: ReadableStream): Promise<{ inputTokens: number; outputTokens: number }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const evt = JSON.parse(jsonStr) as Record<string, unknown>;
          if (evt.type === 'message_start') {
            const usage = (evt.message as Record<string, unknown>)?.usage as Record<string, number> | undefined;
            if (usage) { inputTokens = usage.input_tokens ?? 0; outputTokens = usage.output_tokens ?? 0; }
          } else if (evt.type === 'message_delta') {
            const usage = evt.usage as Record<string, number> | undefined;
            if (usage?.output_tokens) outputTokens = usage.output_tokens;
          }
        } catch { /* ignore malformed lines */ }
      }
    }
  } catch { /* ignore stream errors */ } finally {
    reader.releaseLock();
  }
  return { inputTokens, outputTokens };
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { vendor } = await context.params;

  if (!isValidVendor(vendor)) {
    return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 });
  }

  const subKey = req.headers.get('x-api-key');
  const masterKeys = (process.env[`${vendor.toUpperCase()}_MASTER_KEY`] ?? '')
    .split(',').map(k => k.trim()).filter(Boolean);

  if (masterKeys.length === 0) {
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

    const kd = keyData as {
      expiresAt?: string | null;
      totalQuota?: number | null;
      usage?: number;
      inputTokens?: number;
      outputTokens?: number;
      costUsd?: number;
    };

    const kMeta = { vendor: (keyData as { vendor: string }).vendor, group: (keyData as { group: string }).group, name: (keyData as { name: string }).name };

    if (kd.expiresAt && new Date(kd.expiresAt) < new Date()) {
      void logEvent({ type: 'key.expired', subKey: subKey.slice(-8), ...kMeta, timestamp: new Date().toISOString() });
      return NextResponse.json({ error: 'Key expired' }, { status: 403 });
    }

    // Quota check: token-based (totalQuota = max token budget)
    if (kd.totalQuota != null) {
      const usedTokens = (kd.inputTokens ?? 0) + (kd.outputTokens ?? 0);
      if (usedTokens >= kd.totalQuota) {
        void logEvent({ type: 'quota.exceeded', subKey: subKey.slice(-8), ...kMeta, timestamp: new Date().toISOString() });
        return NextResponse.json({ error: 'Quota exceeded' }, { status: 429 });
      }
    }

    const rawBody = await req.text();
    const model = safeModelFromBody(rawBody);
    const streaming = isStreaming(rawBody);

    const upstream = buildUpstreamRequest(vendor, masterKeys[0], rawBody);
    console.log(`[proxy] ${vendor} key=${subKey.slice(-8)} model=${model ?? '?'} stream=${streaming} → ${upstream.url}`);

    const response = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body: upstream.body,
    });

    if (!response.ok) {
      console.warn(`[proxy] ${vendor} key=${subKey.slice(-8)} ✗ HTTP ${response.status}`);
      const errData = await response.json().catch(() => ({ error: 'Upstream error' }));
      return NextResponse.json(errData, { status: response.status });
    }

    // Increment call count + lastUsed (fire-and-forget)
    const now = new Date().toISOString();
    void redis.hset('vault:subkeys', {
      [subKey]: JSON.stringify({ ...keyData, usage: (kd.usage ?? 0) + 1, lastUsed: now }),
    });

    const today = now.slice(0, 10);
    void redis.incr(`vault:daily:calls:${today}`)
      .then(() => redis.expire(`vault:daily:calls:${today}`, 35 * 24 * 3600))
      .catch((err) => console.warn('[analytics] daily counter failed', err));

    // Streaming: pipe SSE through, parse tokens in background
    if (streaming && response.body) {
      const [clientStream, parseStream] = response.body.tee();

      void extractTokensFromSSE(parseStream).then(async ({ inputTokens, outputTokens }) => {
        if (inputTokens === 0 && outputTokens === 0) return;
        const costInc = estimateVendorCostUsd(vendor, model, { inputTokens, outputTokens });
        console.log(`[proxy] ${vendor} key=${subKey.slice(-8)} ✓ stream in=${inputTokens} out=${outputTokens} cost=$${costInc.toFixed(6)}`);
        void logEvent({ type: 'proxy.success', subKey: subKey.slice(-8), ...kMeta, timestamp: new Date().toISOString(), model: model ?? undefined, inputTokens, outputTokens });
        const latest = parseKeyRecord(await redis.hget('vault:subkeys', subKey)) ?? keyData;
        const lk = latest as { inputTokens?: number; outputTokens?: number; costUsd?: number };
        void redis.hset('vault:subkeys', {
          [subKey]: JSON.stringify({
            ...latest,
            inputTokens: (lk.inputTokens ?? 0) + inputTokens,
            outputTokens: (lk.outputTokens ?? 0) + outputTokens,
            costUsd: (lk.costUsd ?? 0) + costInc,
          }),
        });
      });

      const headers = new Headers();
      headers.set('Content-Type', response.headers.get('Content-Type') ?? 'text/event-stream');
      headers.set('Cache-Control', 'no-cache');
      return new Response(clientStream, { status: response.status, headers });
    }

    // Non-streaming: parse JSON + update tokens/cost
    const data = await response.json() as Record<string, unknown>;
    const tokenUsage = extractTokenUsage(vendor, data);
    const inputInc = tokenUsage?.inputTokens ?? 0;
    const outputInc = tokenUsage?.outputTokens ?? 0;
    const costInc = tokenUsage ? estimateVendorCostUsd(vendor, model, tokenUsage) : 0;
    console.log(`[proxy] ${vendor} key=${subKey.slice(-8)} ✓ in=${inputInc} out=${outputInc} cost=$${costInc.toFixed(6)}`);
    void logEvent({ type: 'proxy.success', subKey: subKey.slice(-8), ...kMeta, timestamp: new Date().toISOString(), model: model ?? undefined, inputTokens: inputInc, outputTokens: outputInc });

    const latest = parseKeyRecord(await redis.hget('vault:subkeys', subKey)) ?? keyData;
    const lk = latest as { inputTokens?: number; outputTokens?: number; costUsd?: number };
    void redis.hset('vault:subkeys', {
      [subKey]: JSON.stringify({
        ...latest,
        inputTokens: (lk.inputTokens ?? 0) + inputInc,
        outputTokens: (lk.outputTokens ?? 0) + outputInc,
        costUsd: (lk.costUsd ?? 0) + costInc,
      }),
    });

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[proxy] ${vendor} key=${subKey.slice(-8)} fatal`, error);
    return NextResponse.json({ error: 'Proxy Error' }, { status: 500 });
  }
}
