import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ToastContainer } from "@/components/Toast";
import Providers from "@/components/Providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getSiteUrl } from "@/lib/env";
import { OG_LOCALE } from '@/lib/i18n';

const siteUrl = getSiteUrl();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SecrétariatPro — Trouvez une secrétaire qualifiée ou une mission",
    template: "%s | SecrétariatPro",
  },
  description:
    "Plateforme de mise en relation entre entreprises et secrétaires qualifiées. Profils vérifiés, mise en relation en quelques minutes, contrats générés automatiquement.",
  applicationName: "SecrétariatPro",
  // Renseignés pour les moteurs et les réseaux sociaux ; absents jusqu'ici, ce
  // qui privait les pages de tout signal d'auteur et de langue alternative.
  authors: [{ name: "SecrétariatPro" }],
  creator: "SecrétariatPro",
  publisher: "SecrétariatPro",
  category: "business",
  keywords: [
    "secrétaire",
    "télésecrétariat",
    "secrétaire indépendante",
    "assistante administrative",
    "mission secrétariat",
    "Côte d'Ivoire",
  ],
  appleWebApp: {
    capable: true,
    title: "SecrétariatPro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Sans canonical explicite, chaque déploiement de prévisualisation Vercel
  // devient une copie indexable du site en production.
  alternates: { canonical: siteUrl },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "SecrétariatPro — Trouvez une secrétaire qualifiée ou une mission",
    description:
      "Profils vérifiés, mise en relation en quelques minutes, contrats générés automatiquement.",
    url: siteUrl,
    siteName: "SecrétariatPro",
    locale: OG_LOCALE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecrétariatPro",
    description: "Mise en relation entre entreprises et secrétaires qualifiées.",
  },
  metadataBase: new URL(siteUrl),
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `data-scroll-behavior` indique à Next que le défilement doux est
  // volontaire : sans cet attribut, il avertit et désactive son propre
  // repositionnement lors des changements de route.
  return (
    <html lang="fr" className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon.png" type="image/png" sizes="256x256" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Négociation TLS engagée avant même que le script ne soit demandé :
            économise environ un aller-retour sur les écrans d'authentification. */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin} crossOrigin="anonymous" />
        )}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" />
        )}
        <noscript>
          <style>{`.noscript-hidden { display: none !important; }`}</style>
        </noscript>
      </head>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased selection:bg-blue-500 selection:text-white bg-slate-50 text-slate-900`} suppressHydrationWarning>
        <Providers>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg">
            Aller au contenu principal
          </a>
          <Navbar />
          <ToastContainer />
          <SpeedInsights />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
