import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, profil: null, error };

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: profil } = await supabaseAdmin
    .from('profils')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle();

  if (profil?.role !== 'admin') {
    return { user: null, profil: null, error: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) };
  }
  return { user, profil, error: null };
}

export async function requireOwnership(userId: string) {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (user!.id !== userId) {
    return { user: null, error: NextResponse.json({ error: 'Accès interdit' }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function checkApiRateLimit(identifier: string, limit = 10, windowMs = 60000) {
  const result = await checkRateLimit(identifier, limit, windowMs);
  if (!result.allowed) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques secondes.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
      ),
    };
  }
  return { allowed: true, error: null };
}

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T | null; error: NextResponse | null } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message || 'Données invalides';
    return { data: null, error: NextResponse.json({ error: firstError }, { status: 400 }) };
  }
  return { data: result.data, error: null };
}

export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(sanitized[key] as string);
    }
  }
  return sanitized;
}

export function isAllowedRedirect(url: string, allowedHosts: string[]): boolean {
  try {
    if (url.startsWith('/') && !url.startsWith('//')) return true;
    const parsed = new URL(url);
    return allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function logAuditEvent(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  action: string,
  details?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details: details ? JSON.stringify(details) : null,
      ip_address: null,
      created_at: new Date().toISOString(),
    });
  } catch {
    console.error('[Audit] Failed to log event:', action);
  }
}
