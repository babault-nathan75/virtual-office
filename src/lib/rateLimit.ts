import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Fallback to in-memory if Redis not configured
const memoryStore = new Map<string, { count: number; resetAt: number }>();

if (!redis && process.env.VERCEL) {
  console.warn('[rateLimit] Upstash Redis not configured. In-memory rate limiter is NOT shared across serverless instances on Vercel. Each request gets a fresh window. Configure UPSTASH_REDIS_REST_URL for production.');
}

export const rateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    })
  : null;

export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  if (rateLimiter) {
    const result = await rateLimiter.limit(identifier);
    return { allowed: result.success, remaining: result.remaining };
  }

  const now = Date.now();
  const entry = memoryStore.get(identifier);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: 9 };
  }
  entry.count++;
  return { allowed: entry.count <= 10, remaining: Math.max(0, 10 - entry.count) };
}

// Backward-compatible rateLimit function for existing API routes
export function rateLimit(identifier: string, limit = 10, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(identifier);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count++;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}
