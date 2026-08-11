import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ensureProfileSchema = z.object({
  userId: z.string().uuid(),
  nom: z.string().min(1).max(200).optional(),
  role: z.enum(['entreprise', 'secretaire', 'admin']),
  emailConfirmed: z.boolean().optional(),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit('ensure-profile', 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const body = await request.json();
  const parsed = ensureProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  }

  const { userId, nom, role, emailConfirmed, email } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { data: existing } = await supabaseAdmin
    .from('profils')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ role: existing.role || role });
  }

  if (email) {
    const { data: existingByEmail } = await supabaseAdmin
      .from('profils')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (existingByEmail && existingByEmail.id !== userId) {
      await supabaseAdmin
        .from('profils')
        .update({ id: userId, role, nom: nom || 'Utilisateur' })
        .eq('id', existingByEmail.id);
      return NextResponse.json({ role });
    }
  }

  const insertData: Record<string, unknown> = { id: userId, role, nom: nom || 'Utilisateur' };
  if (email) insertData.email = email;
  if (emailConfirmed === false) {
    insertData.email_confirmed = false;
  }

  const { data, error } = await supabaseAdmin
    .from('profils')
    .insert(insertData)
    .select('role')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const { data: existingProf } = await supabaseAdmin
        .from('profils')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      return NextResponse.json({ role: existingProf?.role || role });
    }
    console.error('[ensure-profile] Insert error:', JSON.stringify(error));
    return NextResponse.json({ role, error: 'Erreur serveur' }, { status: 500 });
  }

  return NextResponse.json({ role: data?.role || role });
}
