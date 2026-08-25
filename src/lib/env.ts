/**
 * Accès centralisé et validé aux variables d'environnement.
 *
 * Avant, chaque route lisait `process.env.X!` : l'assertion non-nulle de
 * TypeScript masquait l'absence de la variable jusqu'à ce que la requête
 * explose en production avec un message illisible. Ici, une variable manquante
 * échoue immédiatement et nomme précisément ce qu'il faut configurer.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Ajoutez-la dans .env (voir .env.example).`
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get smtpUser() {
    return required('SMTP_USER');
  },
  get smtpPass() {
    return required('SMTP_PASS');
  },
  get turnstileSecretKey() {
    return optional('TURNSTILE_SECRET_KEY');
  },
  get turnstileSiteKey() {
    return optional('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
  },
};

/**
 * Secret de signature applicatif (poivre des empreintes OTP, HMAC du cookie de
 * défi de connexion).
 *
 * Volontairement sans valeur de repli en production : un secret par défaut
 * partagé rendrait forgeables tous les jetons qu'il protège. En développement,
 * on dérive une valeur stable de la clé service role pour ne pas imposer une
 * étape de configuration supplémentaire.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "AUTH_SECRET manquant ou trop court (32 caractères minimum). Générez-le avec : openssl rand -base64 48"
    );
  }
  return `dev-only:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'insecure'}`;
}

/**
 * URL publique canonique du site.
 *
 * Utilisée pour les liens des emails, les métadonnées SEO, le sitemap et la
 * validation des redirections. L'ordre de résolution évite le domaine en dur
 * qui traînait dans quatre fichiers différents.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // Déploiement de production Vercel (domaine stable du projet).
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;

  // Déploiement de prévisualisation.
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return 'http://localhost:3000';
}

export function getAllowedOrigins(): string[] {
  const site = getSiteUrl();
  const extra = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return Array.from(
    new Set([site, 'http://localhost:3000', 'http://localhost:3001', ...extra])
  );
}
