/**
 * Unified endpoint: accepts OpenAI Chat Completions format,
 * converts to Anthropic Messages format, proxies to Claude/YourAgent,
 * and converts the response back to OpenAI format.
 *
 * POST /api/v1/unified
 * Headers: x-api-key: sk-vault-claude-xxx or sk-vault-youragent-xxx
 * Body: OpenAI Chat Completions format
 *
 * This allows tools that only support OpenAI format to use Claude via Token Bank.
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { buildUpstreamRequest } from '@/lib/proxy';
import { openaiToAnthropic, anthropicToOpenai } from '@/lib/convert';
import { extractTokenUsage, estimateVendorCostUsd } from '@/lib/billing';
import { logEvent } from '@/lib/events';
import { proxyRateLimit } from '@/lib/ratelimit';
import type { VendorId } from '@/lib/types';

const parseKeyRecord = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
};

export async function POST(req: NextRequest) {
  const subKey = req.headers.get('x-api-key');
  if (!subKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
  }

  try {
    const keyDataStr = await redis.hget('vault:subkeys', subKey);
    const keyData = parseKeyRecord(keyDataStr);
    if (!keyData) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
    }

    const vendor = (keyData as { vendor: string }).vendor as VendorId;
    // Unified endpoint only supports Anthropic-compatible vendors
    if (vendor !== 'claude' && vendor !== 'youragent') {
      return NextResponse.json(
        { error: 'Unified endpoint only supports claude and youragent keys' },
        { status: 400 },
      );
    }

    const kd = keyData as {
      expiresAt?: string | null;
      totalQuota?: number | null;
      usage?: number;
      inputTokens?: number;
      outputTokens?: number;
      costUsd?: number;
    };
    const kMeta = {
      vendor: (keyData as { vendor: string }).vendor,
      group: (keyData as { group: string }).group,
      name: (keyData as { name: string }).name,
    };

    if (kd.expiresAt && new Date(kd.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Key expired' }, { status: 403 });
    }

    const rl = await proxyRateLimit.limit(subKey);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }

    if (kd.totalQuota != null) {
      const usedTokens = (kd.inputTokens ?? 0) + (kd.outputTokens ?? 0);
      if (usedTokens >= kd.totalQuota) {
        return NextResponse.json({ error: 'Quota exceeded' }, { status: 429 });
      }
    }

    // Parse OpenAI format body and convert to Anthropic format
    const openaiBody = await req.json();
    const anthropicBody = openaiToAnthropic(openaiBody);

    const masterKeys = (process.env[`${vendor.toUpperCase()}_MASTER_KEY`] ?? '')
      .split(',').map(k => k.trim()).filter(Boolean);
    if (masterKeys.length === 0) {
      return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
    }

    const rawBody = JSON.stringify(anthropicBody);
    const model = anthropicBody.model;

    // Non-streaming only for unified endpoint (streaming conversion is complex)
    const upstream = buildUpstreamRequest(vendor, masterKeys[0], rawBody);
    const response = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body: upstream.body,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Upstream error' }));
      return NextResponse.json(errData, { status: response.status });
    }

    const anthropicData = await response.json() as Record<string, unknown>;

    // Update usage stats
    const now = new Date().toISOString();
    void redis.hset('vault:subkeys', {
      [subKey]: JSON.stringify({ ...keyData, usage: (kd.usage ?? 0) + 1, lastUsed: now }),
    });

    const today = now.slice(0, 10);
    void redis.incr(`vault:daily:calls:${today}`)
      .then(() => redis.expire(`vault:daily:calls:${today}`, 35 * 24 * 3600))
      .catch(() => {});

    const tokenUsage = extractTokenUsage(vendor, anthropicData);
    if (tokenUsage) {
      const costInc = estimateVendorCostUsd(vendor, model, tokenUsage);
      void logEvent({
        type: 'proxy.success',
        subKey: subKey.slice(-8),
        ...kMeta,
        timestamp: now,
        model,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
      });
      const latest = parseKeyRecord(await redis.hget('vault:subkeys', subKey)) ?? keyData;
      const lk = latest as { inputTokens?: number; outputTokens?: number; costUsd?: number };
      void redis.hset('vault:subkeys', {
        [subKey]: JSON.stringify({
          ...latest,
          inputTokens: (lk.inputTokens ?? 0) + tokenUsage.inputTokens,
          outputTokens: (lk.outputTokens ?? 0) + tokenUsage.outputTokens,
          costUsd: (lk.costUsd ?? 0) + costInc,
        }),
      });
    }

    // Convert Anthropic response back to OpenAI format
    const openaiResponse = anthropicToOpenai(anthropicData as Parameters<typeof anthropicToOpenai>[0]);
    return NextResponse.json(openaiResponse);
  } catch (error) {
    console.error('[unified] fatal', error);
    return NextResponse.json({ error: 'Proxy Error' }, { status: 500 });
  }
}
