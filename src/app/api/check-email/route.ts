import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

const checkEmailSchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: NextRequest) {
  const rateLimitResult = await checkRateLimit('check-email', 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = checkEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    const { data } = await supabaseAdmin
      .from('profils')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .limit(1)
      .single();

    return NextResponse.json({ exists: !!data });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
