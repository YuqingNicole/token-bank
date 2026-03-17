import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// Sliding window: 20 requests per 60 seconds per sub-key
export const proxyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  prefix: 'vault:rl',
  analytics: false,
});
