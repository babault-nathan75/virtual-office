'use client';

import { supabase } from '@/lib/supabaseClient';

export const KYC_BUCKETS = {
  piece_identite: 'kyc-identite',
  selfie: 'kyc-selfies',
  document_entreprise: 'kyc-entreprises',
} as const;

export async function getKycSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}