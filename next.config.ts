import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera=(self) : la vérification KYC (PhotoCapture) et l'enregistrement
  // vocal du chat appellent getUserMedia. Avec « camera=() » le bouton
  // « Prendre avec la caméra » échouait systématiquement.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=()' },
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
  images: {
    remotePatterns: [
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
    { source: '/api/:path*', headers: [...securityHeaders, { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }] },
    { source: '/images/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
  ],
  experimental: { optimizePackageImports: ['@heroicons/react', 'lucide-react'] },
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
