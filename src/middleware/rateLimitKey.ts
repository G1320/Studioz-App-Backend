import type { Request } from 'express';

/**
 * Behind Cloudflare + Render, `req.ip` is a proxy address shared by many visitors, so
 * per-IP limits would throttle everyone together. Cloudflare overwrites CF-Connecting-IP
 * with the real client address on every request.
 */
export function rateLimitKey(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp) return cfIp;
  return req.ip || req.socket.remoteAddress || 'unknown';
}
