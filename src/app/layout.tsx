import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PWAInit from "@/components/PWAInit";
import { ToastContainer } from "@/components/Toast";
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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased selection:bg-blue-500 selection:text-white bg-slate-50 text-slate-900`}>
        <Navbar />
        <PWAInit />
        <ToastContainer />
        <SpeedInsights />
        {children}
        <footer className="border-t border-slate-100 bg-white py-5 px-4 text-center text-xs text-slate-500 font-medium">
          <span>© {new Date().getFullYear()} SecrétariatPro</span>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/mentions-legales" className="hover:text-blue-700 transition">Mentions légales</Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/cgu" className="hover:text-blue-700 transition">CGU</Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/confidentialite" className="hover:text-blue-700 transition">Confidentialité</Link>
        </footer>
      </body>
    </html>
  );
}