import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';


async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), ms))]);
}

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    const dbResult = await withTimeout(
      (async () => {
        const r = await getSupabaseAdmin().from('profils').select('id', { count: 'exact', head: true });
        return r;
      })(),
      5000
    );
    checks.database = dbResult === 'timeout' ? 'timeout' : dbResult.error ? 'error' : 'ok';
  } catch {
    checks.database = 'error';
  }

  checks.smtp = process.env.SMTP_USER && process.env.SMTP_PASS ? 'configured' : 'not_configured';
  checks.redis = process.env.UPSTASH_REDIS_REST_URL ? 'configured' : 'not_configured';
  checks.vapid = process.env.VAPID_PUBLIC_KEY ? 'configured' : 'not_configured';
  checks.gemini = process.env.GEMINI_API_KEY ? 'configured' : 'not_configured';

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'configured');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 });
}
