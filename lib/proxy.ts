import type { VendorId } from './types';
import { VENDOR_CONFIG } from './vendors';

interface UpstreamRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function buildUpstreamRequest(
  vendor: VendorId,
  masterKey: string,
  rawBody: string
): UpstreamRequest {
  const config = VENDOR_CONFIG[vendor];

  if (vendor === 'claude' || vendor === 'youragent') {
    return {
      url: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': masterKey,
        'anthropic-version': '2023-06-01',
      },
      body: rawBody,
    };
  }

  if (vendor === 'openai' || vendor === 'yunwu') {
    return {
      url: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterKey}`,
      },
      body: rawBody,
    };
  }

  // gemini: extract model from body, build URL with model, remove model from body
  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    parsedBody = {};
  }
  const model = typeof parsedBody.model === 'string' ? parsedBody.model : 'gemini-pro';
  const { model: _model, ...bodyWithoutModel } = parsedBody;
  void _model;

  const url = config.endpoint.replace('{model}', model) + `?key=${masterKey}`;

  return {
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyWithoutModel),
  };
}
