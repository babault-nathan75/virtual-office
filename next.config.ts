import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactCompiler: false,
  turbopack: { root: "C:/Users/hp/Desktop/Projet/secretariat-en-ligne" },
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

export default nextConfig;
