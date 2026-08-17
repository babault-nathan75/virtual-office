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

/**
 * Identifiant de l'appelant pour le quota. À utiliser comme suffixe de clé :
 * une clé constante ferait partager un seul quota par TOUS les visiteurs,
 * ce qui transforme la limite en déni de service mutuel.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// Un limiteur Upstash est figé sur sa fenêtre : on en mémorise un par couple
// (limite, fenêtre) pour que les arguments passés soient réellement respectés.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const cacheKey = `${limit}:${windowSeconds}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: true,
      prefix: `rl:${cacheKey}`,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit(identifier: string, limit = 10, windowMs = 60000): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getLimiter(limit, windowMs);
  if (limiter) {
    const result = await limiter.limit(identifier);
    return { allowed: result.success, remaining: result.remaining };
  }

  return rateLimit(identifier, limit, windowMs);
}

// Backward-compatible rateLimit function for existing API routes
export function rateLimit(identifier: string, limit = 10, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Purge des fenêtres expirées : sans cela la Map croît indéfiniment
  // (une entrée par IP) sur un process long.
  if (memoryStore.size > 5000) {
    for (const [key, value] of memoryStore) {
      if (now > value.resetAt) memoryStore.delete(key);
    }
  }

  const entry = memoryStore.get(identifier);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count++;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}
