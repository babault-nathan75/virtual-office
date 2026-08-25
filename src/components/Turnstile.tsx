'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  language?: string;
  callback?: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileScriptPromise?: Promise<void>;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Charge le script Cloudflare une seule fois par page.
 *
 * Deux widgets (inscription et connexion partagent ce composant) doivent
 * pouvoir coexister sans injecter deux fois la balise, ce qui provoquerait
 * une double initialisation et des rendus fantômes.
 */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptPromise) return window.__turnstileScriptPromise;

  window.__turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile-script')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile-script'));
    document.head.appendChild(script);
  });

  return window.__turnstileScriptPromise;
}

export type TurnstileHandle = {
  reset: () => void;
};

type Props = {
  siteKey: string;
  action: 'signup' | 'login' | 'password_reset';
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
  /** Exposé au parent pour réinitialiser le widget après un échec serveur. */
  resetSignal?: number;
};

/**
 * Vérification humaine Cloudflare Turnstile.
 *
 * Choisi plutôt qu'un CAPTCHA classique : dans la grande majorité des cas
 * l'utilisateur n'a rien à faire — pas d'image à déchiffrer, donc pas de perte
 * de conversion sur le formulaire d'inscription, et pas d'obstacle
 * d'accessibilité pour les personnes malvoyantes.
 */
export default function Turnstile({
  siteKey,
  action,
  onVerify,
  onExpire,
  onError,
  className = '',
  resetSignal = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const fallbackId = useId();

  // Les callbacks sont conservés dans une ref : les réinscrire à chaque rendu
  // forcerait la destruction/recréation du widget et ferait perdre le jeton
  // déjà obtenu.
  const handlers = useRef({ onVerify, onExpire, onError });
  useEffect(() => {
    handlers.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  const render = useCallback(() => {
    const container = containerRef.current;
    if (!container || !window.turnstile) return;

    container.innerHTML = '';
    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      action,
      theme: 'light',
      size: 'flexible',
      language: 'fr',
      callback: token => {
        setStatus('ready');
        handlers.current.onVerify(token);
      },
      'expired-callback': () => handlers.current.onExpire?.(),
      'timeout-callback': () => handlers.current.onExpire?.(),
      'error-callback': () => {
        setStatus('failed');
        handlers.current.onError?.();
      },
    });
    setStatus('ready');
  }, [siteKey, action]);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        render();
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('failed');
        handlers.current.onError?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget déjà retiré par le script */
        }
        widgetIdRef.current = null;
      }
    };
  }, [render]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        id={`turnstile-${fallbackId}`}
        // Réserve la hauteur du widget avant son chargement : sans cela le
        // bouton d'envoi saute au moment où l'iframe apparaît (CLS).
        className="min-h-[65px]"
        aria-live="polite"
      />
      {status === 'loading' && (
        <p className="text-xs text-slate-400">Chargement de la vérification de sécurité…</p>
      )}
      {status === 'failed' && (
        <p className="text-xs text-amber-600 font-medium">
          La vérification de sécurité n&apos;a pas pu se charger. Vérifiez votre connexion ou
          désactivez votre bloqueur de contenu, puis rechargez la page.
        </p>
      )}
    </div>
  );
}
