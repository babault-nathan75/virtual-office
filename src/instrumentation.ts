import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';

/**
 * Point d'entrée d'instrumentation serveur.
 *
 * Les fichiers `sentry.*.config.ts` existaient déjà mais n'étaient chargés par
 * rien : sans ce fichier ni `withSentryConfig`, aucun `Sentry.init()` n'était
 * jamais exécuté et l'application n'avait aucune remontée d'erreur en
 * production.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Remonte les erreurs survenues pendant le rendu serveur, les Server Actions
 * et les route handlers — que `register()` seul ne capture pas.
 */
export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
