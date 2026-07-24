import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PWAInit from "@/components/PWAInit";
import { ToastContainer } from "@/components/Toast";
import Providers from "@/components/Providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    default: "SecrétariatPro - Mise en relation entreprises et secrétaires",
    template: "%s | SecrétariatPro",
  },
  description: "Plateforme de mise en relation entre entreprises et secrétaires qualifiées. Trouvez la secrétaire idéale ou publiez vos missions en quelques clics.",
  applicationName: "SecrétariatPro",
  appleWebApp: {
    capable: true,
    title: "SecrétariatPro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "SecrétariatPro - Mise en relation entreprises et secrétaires",
    description: "Plateforme de mise en relation entre entreprises et secrétaires qualifiées.",
    url: "https://secretariatpro.vercel.app",
    siteName: "SecrétariatPro",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecrétariatPro",
    description: "Mise en relation entre entreprises et secrétaires qualifiées.",
  },
  metadataBase: new URL("https://secretariatpro.vercel.app"),
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SecrétariatPro',
    url: 'https://secretariatpro.vercel.app',
    description: 'Plateforme de mise en relation entre entreprises et secrétaires qualifiées.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'French',
    },
  };

  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" />
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased selection:bg-blue-500 selection:text-white bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100`}>
        <Providers>
          <Navbar />
          <PWAInit />
          <ToastContainer />
          <SpeedInsights />
          {children}
          <footer className="border-t border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-800 py-5 px-4 text-center text-xs text-slate-500 dark:text-gray-400 font-medium">
            <span>© {new Date().getFullYear()} SecrétariatPro</span>
            <span className="mx-2 text-slate-300 dark:text-gray-600">·</span>
            <Link href="/mentions-legales" className="hover:text-blue-700 dark:hover:text-blue-400 transition">Mentions légales</Link>
            <span className="mx-2 text-slate-300 dark:text-gray-600">·</span>
            <Link href="/cgu" className="hover:text-blue-700 dark:hover:text-blue-400 transition">CGU</Link>
            <span className="mx-2 text-slate-300 dark:text-gray-600">·</span>
            <Link href="/confidentialite" className="hover:text-blue-700 dark:hover:text-blue-400 transition">Confidentialité</Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
