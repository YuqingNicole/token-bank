import type { VendorId, VendorConfig } from './types';

export const VENDOR_CONFIG: Record<VendorId, VendorConfig> = {
  claude: {
    label: 'Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authStyle: 'x-api-key',
    envKey: 'CLAUDE_MASTER_KEY',
    keyPrefix: 'claude',
    basePath: '/api/v1/claude',
  },
  youragent: {
    label: 'YourAgent',
    endpoint: 'https://your-agent.cc/api/v1/messages',
    authStyle: 'x-api-key',
    envKey: 'YOURAGENT_MASTER_KEY',
    keyPrefix: 'youragent',
    basePath: '/api/v1/youragent',
  },
  yunwu: {
    label: 'Yunwu',
    endpoint: 'https://yunwu.ai/v1/chat/completions',
    authStyle: 'bearer',
    envKey: 'YUNWU_MASTER_KEY',
    keyPrefix: 'yunwu',
    basePath: '/api/v1/yunwu',
  },
};

export function isValidVendor(v: unknown): v is VendorId {
  return v === 'claude' || v === 'youragent' || v === 'yunwu';
}
