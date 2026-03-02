export type VendorId = 'claude' | 'openai' | 'gemini';
export type AuthStyle = 'x-api-key' | 'bearer' | 'query-param';

export interface VendorConfig {
  label: string;
  endpoint: string;
  authStyle: AuthStyle;
  envKey: string;
  keyPrefix: string;
  basePath: string;
}

export interface SubKeyData {
  name: string;
  vendor: VendorId;
  group: string;
  usage: number;
  createdAt: string;
  lastUsed: string | null;
}

export interface SubKeyRecord extends SubKeyData {
  key: string;
  baseUrl: string;
}
