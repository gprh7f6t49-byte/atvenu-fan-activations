// In-memory fixed-window limiter. Fine for a single-server pilot; move to Redis
// (or the platform's edge rate limiting) if the app runs on more than one instance.

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

/** For failure-only limits: check before acting, then record only failed attempts. */
export function isLimited(key: string, max: number): boolean {
  const entry = hits.get(key);
  return Boolean(entry && entry.resetAt >= Date.now() && entry.count >= max);
}

export function recordHit(key: string, windowMs: number): void {
  rateLimited(key, Number.POSITIVE_INFINITY, windowMs);
}
