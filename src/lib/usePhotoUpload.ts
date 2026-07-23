'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type UploadResult = {
  url: string | null;
  error: string | null;
  loading: boolean;
};

export function usePhotoUpload(userId: string | null) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, bucket: string = 'avatars'): Promise<UploadResult> => {
    if (!userId) return { url: null, error: 'Utilisateur non connecté', loading: false };
    if (file.size > 5 * 1024 * 1024) return { url: null, error: 'Photo trop lourde (max 5 Mo)', loading: false };

    setUploading(true);

    try {
      // Nettoyage des anciens fichiers
      const { data: existing } = await supabase.storage.from(bucket).list(userId);
      if (existing && existing.length) {
        await supabase.storage
          .from(bucket)
          .remove(existing.map(f => `${userId}/${f.name}`));
      }

      // Upload
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // URL publique + cache-buster
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = `${publicUrl}?v=${Date.now()}`;

      return { url, error: null, loading: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { url: null, error: msg, loading: false };
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
