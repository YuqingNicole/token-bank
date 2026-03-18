import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { isValidVendor, VENDOR_CONFIG, VENDOR_MODELS } from '@/lib/vendors';
import type { VendorId } from '@/lib/types';

const CACHE_KEY = 'vault:models';
const CACHE_TTL = 3600; // 1 hour

// Prefixes/patterns that indicate non-chat models (image, video, audio, embedding, rerank, OCR, etc.)
const EXCLUDE_PREFIXES = [
  // Image generation
  'dall-e', 'gpt-image', 'flux', 'black-forest', 'fal-ai', 'stability-ai',
  'recraft', 'ideogram', 'google/imagen', 'z-image', 'qwen-image',
  'grok-3-image', 'grok-4-image', 'grok-4.1-image', 'grok-4.2-image',
  'doubao-seedream', 'doubao-seededit',
  // Video generation
  'sora', 'veo', 'kling', 'luma', 'runway', 'wan', 'vidu',
  'doubao-seedance', 'aigc-image', 'aigc-video', 'grok-video',
  'minimax/video',
  // Audio / TTS / STT
  'tts-', 'speech-', 'whisper', 'gpt-audio', 'gpt-realtime',
  'gpt-4o-mini-tts', 'gpt-4o-mini-transcribe', 'gpt-4o-mini-audio',
  'gpt-4o-transcribe', 'gpt-4o-audio', 'gpt-4o-mini-realtime',
  'gpt-4o-realtime', 'qwen3-tts', 'vidu-tts',
  'suno_', 'riffusion', 'audio', 'MiniMax-Voice',
  // Embedding / Rerank
  'text-embedding', 'Embedding', 'bge-reranker', 'qwen3-rerank',
  'BAAI/', 'netease-youdao', 'gemini-embedding', 'Qwen/Qwen3-Reranker',
  // Legacy / non-chat
  'babbage', 'davinci', 'text-babbage', 'text-curie', 'gpt-oss',
  'mj_', 'lucataco', 'cjwbw', 'sujaykhandekar', 'prunaai', 'andreasjansson',
  'MiniMax-File',
  // OCR / specialized
  'deepseek-ocr',
  // Search variants (not standard chat)
  'gpt-4o-search', 'gpt-4o-mini-search',
];

function isExcluded(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return EXCLUDE_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
}

// Detect vendor/group from model ID
function detectGroup(modelId: string): string {
  if (modelId.startsWith('claude-')) return 'Claude';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4') || modelId.startsWith('codex')) return 'OpenAI';
  if (modelId.startsWith('gemini-') || modelId.startsWith('gemma-')) return 'Google';
  if (modelId.startsWith('grok-')) return 'xAI';
  if (modelId.startsWith('deepseek-')) return 'DeepSeek';
  if (modelId.startsWith('qwen') || modelId.startsWith('qvq') || modelId.startsWith('qwq')) return 'Qwen';
  if (modelId.startsWith('glm-')) return 'GLM';
  if (modelId.startsWith('llama-') || modelId.startsWith('meta-llama')) return 'Meta';
  if (modelId.startsWith('mistral-')) return 'Mistral';
  if (modelId.startsWith('moonshot-') || modelId.startsWith('kimi-')) return 'Moonshot';
  if (modelId.startsWith('minimax') || modelId.startsWith('MiniMax')) return 'MiniMax';
  if (modelId.startsWith('doubao-')) return 'Doubao';
  if (modelId.startsWith('ERNIE-') || modelId.startsWith('SparkDesk')) return 'Baidu';
  if (modelId.startsWith('mimo-') || modelId.startsWith('seed-oss') || modelId.startsWith('MAI-') || modelId.startsWith('mai-')) return 'Other';
  if (modelId.startsWith('longcat-')) return 'Other';
  return 'Other';
}

// Make a nice display label from model ID
function makeLabel(modelId: string): string {
  return modelId;
}

interface ModelEntry {
  label: string;
  value: string;
  group: string;
}

async function fetchYunwuModels(): Promise<ModelEntry[]> {
  const masterKey = process.env.YUNWU_MASTER_KEY;
  if (!masterKey) return [];

  const endpoint = VENDOR_CONFIG.yunwu.endpoint.replace('/chat/completions', '/models');

  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${masterKey}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = await res.json() as { data?: { id: string }[] };
  if (!data.data) return [];

  const models: ModelEntry[] = data.data
    .map((m) => m.id)
    .filter((id) => !isExcluded(id))
    .map((id) => ({
      label: makeLabel(id),
      value: id,
      group: detectGroup(id),
    }));

  // Sort: by group, then alphabetically within group
  models.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.value.localeCompare(b.value);
  });

  return models;
}

export async function GET(req: NextRequest) {
  const vendor = req.nextUrl.searchParams.get('vendor') as string;

  if (!vendor || !isValidVendor(vendor)) {
    return NextResponse.json({ error: 'Invalid vendor' }, { status: 400 });
  }

  // For non-yunwu vendors, return hardcoded list
  if (vendor !== 'yunwu') {
    return NextResponse.json({
      models: VENDOR_MODELS[vendor as VendorId],
      cached: false,
    });
  }

  // Check Redis cache first
  try {
    const cached = await redis.get('vault:models:yunwu');
    if (cached) {
      const models = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return NextResponse.json({ models, cached: true });
    }
  } catch { /* cache miss */ }

  // Fetch from Yunwu API
  try {
    const models = await fetchYunwuModels();

    if (models.length > 0) {
      // Cache in Redis
      await redis.set('vault:models:yunwu', JSON.stringify(models), { ex: CACHE_TTL });
    }

    return NextResponse.json({ models, cached: false });
  } catch (error) {
    console.error('[models] Failed to fetch Yunwu models', error);
    // Fallback to hardcoded
    return NextResponse.json({
      models: VENDOR_MODELS.yunwu,
      cached: false,
      fallback: true,
    });
  }
}
