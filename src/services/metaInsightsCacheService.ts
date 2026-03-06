/**
 * Simple in-memory TTL cache for Meta Insights data.
 * Meta rate-limits the insights endpoints, so we cache responses.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// TTL durations in milliseconds
const TTL = {
  REALTIME: 5 * 60 * 1000,     // 5 minutes
  HISTORICAL: 60 * 60 * 1000,  // 1 hour
  BREAKDOWN: 30 * 60 * 1000    // 30 minutes
} as const;

export type CacheTier = keyof typeof TTL;

function buildKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${JSON.stringify(params[k])}`).join('&');
  return `${prefix}:${sorted}`;
}

export function getCached<T>(prefix: string, params: Record<string, unknown>): T | null {
  const key = buildKey(prefix, params);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(prefix: string, params: Record<string, unknown>, data: T, tier: CacheTier = 'REALTIME'): void {
  const key = buildKey(prefix, params);
  cache.set(key, {
    data,
    expiresAt: Date.now() + TTL[tier]
  });
}

export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${prefix}:`)) {
      cache.delete(key);
    }
  }
}

export function clearAll(): void {
  cache.clear();
}

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export default { getCached, setCached, invalidatePrefix, clearAll };
