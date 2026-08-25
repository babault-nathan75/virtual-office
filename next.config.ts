import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { buildCsp } from "./src/lib/csp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;
const isDev = process.env.NODE_ENV === 'development';

/*
 * Politique sans nonce, pour les pages publiques pré-rendues.
 * La variante à nonce et le détail du compromis vivent dans src/lib/csp.ts.
 */
const baseCsp = buildCsp({ supabaseUrl, isDev });

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // `X-XSS-Protection` a été retiré : l'auditeur XSS des navigateurs
  // correspondant est supprimé partout depuis des années, et sa réactivation
  // a elle-même introduit des vulnérabilités (fuite d'information par
  // détection de blocage). Le CSP ci-dessus le remplace.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera=(self) : la vérification KYC (PhotoCapture) et l'enregistrement
  // vocal du chat appellent getUserMedia. Avec « camera=() » le bouton
  // « Prendre avec la caméra » échouait systématiquement.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactCompiler: false,
  // Chemin résolu depuis le projet : la valeur absolue précédente était celle
  // d'un poste de développement et cassait tout build ailleurs (CI, Vercel).
  turbopack: { root: path.resolve(process.cwd()) },
  allowedDevOrigins: ['172.19.32.1'],
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
    /*
     * Le CSP est posé ici pour les pages publiques, et par `proxy.ts` — avec
     * un nonce — pour les écrans d'authentification et le tableau de bord.
     * L'exclusion évite deux en-têtes concurrents sur la même réponse : le
     * navigateur applique alors l'intersection des deux politiques, ce qui
     * rend le comportement réel difficile à raisonner.
     */
    {
      source: '/((?!connexion|inscription|verification|dashboard).*)',
      headers: [{ key: 'Content-Security-Policy', value: baseCsp }],
    },
    {
      source: '/api/:path*',
      headers: [
        ...securityHeaders,
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
      ],
    },
    // Les écrans d'authentification ne doivent jamais être servis depuis un
    // cache partagé : une réponse mise en cache par un intermédiaire pourrait
    // être renvoyée à un autre visiteur.
    {
      source: '/(connexion|inscription|verification)',
      headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
    },
    {
      source: '/images/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
  experimental: { optimizePackageImports: ['@heroicons/react', 'lucide-react', 'recharts'] },
};

/*
 * `withSentryConfig` téléverse les source maps et instrumente le build.
 *
 * `silent` en dehors de la CI pour ne pas polluer la sortie locale. Les logs de
 * debug sont retirés du bundle via `webpack.treeshake.removeDebugLogging`
 * (l'option `disableLogger` est dépréciée dans @sentry/nextjs 10).
 * Sans DSN configuré, Sentry reste inerte : le build fonctionne à l'identique.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  // Contourne les bloqueurs de publicités qui filtrent les requêtes Sentry.
  tunnelRoute: "/monitoring",
});
