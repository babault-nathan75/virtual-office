/**
 * Instrumentation client, exécutée avant que l'application ne devienne
 * interactive. C'est le point d'entrée attendu par Next pour le code de
 * monitoring côté navigateur ; `sentry.client.config.ts` n'était chargé par
 * aucun mécanisme.
 */
import * as Sentry from '@sentry/nextjs';

import './sentry.client.config';

// Permet à Sentry de rattacher les erreurs aux transitions de navigation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
