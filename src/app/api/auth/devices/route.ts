import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { readDeviceId, revokeAllDevices } from '@/lib/trustedDevice';
import { logAuthEvent } from '@/lib/authEvents';
import crypto from 'node:crypto';
import { getAuthSecret } from '@/lib/env';

export const runtime = 'nodejs';

/**
 * Appareils dispensés de second facteur.
 *
 * Une dispense que l'utilisateur ne peut ni voir ni révoquer n'est pas
 * acceptable : un téléphone perdu resterait autorisé trente jours durant, sans
 * qu'il existe le moindre moyen de le couper. Cette route rend la liste
 * consultable et révocable.
 *
 * `device_hash` n'est jamais renvoyé — seulement un indicateur « c'est
 * l'appareil que vous utilisez en ce moment ».
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const currentDeviceId = await readDeviceId();
  const currentHash = currentDeviceId
    ? crypto
        .createHmac('sha256', getAuthSecret())
        .update(`device:${user.id}:${currentDeviceId}`)
        .digest('hex')
    : null;

  const { data, error } = await getSupabaseAdmin()
    .from('trusted_devices')
    .select('id, device_hash, label, last_used_at, expires_at, created_at')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });

  if (error) {
    console.error('[auth/devices] lecture :', error.message);
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });
  }

  const devices = (data ?? []).map(device => ({
    id: device.id,
    label: device.label ?? 'Appareil inconnu',
    lastUsedAt: device.last_used_at,
    expiresAt: device.expires_at,
    createdAt: device.created_at,
    isCurrent: currentHash !== null && device.device_hash === currentHash,
  }));

  return NextResponse.json({ devices });
}

const deleteSchema = z.object({
  /** Identifiant d'un appareil, ou `all` pour tout révoquer. */
  id: z.union([z.string().uuid(), z.literal('all')]),
});

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rate = await checkRateLimit(`devices-revoke:${user.id}:${getClientIp(request)}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  if (parsed.data.id === 'all') {
    await revokeAllDevices(user.id);
  } else {
    // Le filtre sur `user_id` est indispensable : sans lui, un identifiant
    // d'appareil deviné suffirait à révoquer la confiance d'un tiers.
    await getSupabaseAdmin()
      .from('trusted_devices')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id);
  }

  await logAuthEvent({
    event: 'device_revoked',
    email: user.email ?? null,
    userId: user.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}
