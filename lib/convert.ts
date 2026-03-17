/**
 * Convert between OpenAI Chat Completions format and Anthropic Messages format.
 * Used by the /api/v1/unified endpoint to accept OpenAI-format requests
 * and proxy them to Claude/YourAgent.
 */

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAIRequest = {
  model?: string;
  messages?: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
};

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AnthropicRequest = {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
};

// OpenAI model → Claude model mapping
const MODEL_MAP: Record<string, string> = {
  'gpt-4o': 'claude-sonnet-4-20250514',
  'gpt-4o-mini': 'claude-haiku-4-5-20251001',
  'gpt-4-turbo': 'claude-sonnet-4-20250514',
  'gpt-4': 'claude-opus-4-20250514',
  'gpt-3.5-turbo': 'claude-haiku-4-5-20251001',
};

export function openaiToAnthropic(body: OpenAIRequest): AnthropicRequest {
  const messages: AnthropicMessage[] = [];
  let system: string | undefined;

  for (const msg of body.messages ?? []) {
    if (msg.role === 'system') {
      system = system ? `${system}\n${msg.content}` : msg.content;
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Ensure messages alternate user/assistant properly
  // Claude requires first message to be 'user'
  if (messages.length === 0) {
    messages.push({ role: 'user', content: '' });
  }

  const model = body.model
    ? MODEL_MAP[body.model] ?? body.model  // pass through if already a Claude model
    : 'claude-sonnet-4-20250514';

  const result: AnthropicRequest = {
    model,
    messages,
    max_tokens: body.max_tokens ?? 4096,
    stream: body.stream,
  };

  if (system) result.system = system;
  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.top_p !== undefined) result.top_p = body.top_p;

  return result;
}

type AnthropicResponse = {
  id?: string;
  type?: string;
  role?: string;
  content?: { type: string; text: string }[];
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
};

export function anthropicToOpenai(res: AnthropicResponse) {
  const text = res.content?.map(c => c.text).join('') ?? '';
  return {
    id: res.id ?? `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: res.model ?? 'claude',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: res.stop_reason === 'end_turn' ? 'stop' : (res.stop_reason ?? 'stop'),
      },
    ],
    usage: res.usage
      ? {
          prompt_tokens: res.usage.input_tokens,
          completion_tokens: res.usage.output_tokens,
          total_tokens: res.usage.input_tokens + res.usage.output_tokens,
        }
      : undefined,
  };
}
