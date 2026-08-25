'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { AuthAlert } from '@/components/AuthShell';
import { formatDate, formatDateTime } from '@/lib/i18n';

type Device = {
  id: string;
  label: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
};

/**
 * Appareils dispensés de code de vérification.
 *
 * Contrepartie indispensable de la dispense : sans cet écran, un téléphone
 * perdu resterait autorisé trente jours durant sans aucun moyen de le couper.
 * L'utilisateur voit ce qui est mémorisé en son nom, et peut le révoquer.
 */
export default function TrustedDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/devices');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Lecture impossible.');
        setDevices([]);
        return;
      }
      setDevices(data.devices ?? []);
      setError('');
    } catch {
      setError('Connexion au serveur impossible.');
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      const response = await fetch('/api/auth/devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Révocation impossible.');
        return;
      }
      await load();
    } catch {
      setError('Connexion au serveur impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(15,23,42,0.08)] p-8">
      <h2 className="text-xl font-black tracking-tight text-slate-900 mb-2">
        Appareils mémorisés
      </h2>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        Sur ces appareils, votre mot de passe suffit à vous connecter : le code de
        vérification n&apos;est plus demandé jusqu&apos;à l&apos;expiration indiquée. Révoquez
        tout appareil que vous ne reconnaissez pas ou que vous n&apos;avez plus.
      </p>

      {error && <AuthAlert type="error">{error}</AuthAlert>}

      {devices === null && (
        <p className="text-sm text-slate-400" aria-busy="true">
          Chargement…
        </p>
      )}

      {devices?.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
          Aucun appareil mémorisé. Un code vous est demandé à chaque connexion.
        </p>
      )}

      {devices && devices.length > 0 && (
        <>
          <ul className="space-y-2.5 list-none p-0 m-0">
            {devices.map(device => (
              <li
                key={device.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    {device.label}
                    {device.isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Cet appareil
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dernière utilisation : {formatDateTime(device.lastUsedAt)}
                    {' · '}
                    Expire le {formatDate(device.expiresAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => revoke(device.id)}
                  loading={busy === device.id}
                  disabled={busy !== null}
                >
                  Révoquer
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <Button
              variant="danger"
              size="sm"
              onClick={() => revoke('all')}
              loading={busy === 'all'}
              disabled={busy !== null}
            >
              Révoquer tous les appareils
            </Button>
            <p className="text-xs text-slate-500 mt-2">
              Un code de vérification sera à nouveau demandé partout, y compris ici.
              À faire immédiatement en cas de perte ou de vol d&apos;un appareil.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
