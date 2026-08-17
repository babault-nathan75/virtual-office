import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ToastContainer } from "@/components/Toast";
import Providers from "@/components/Providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";

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
    url: "https://secretariatpro-drab.vercel.app",
    siteName: "SecrétariatPro",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecrétariatPro",
    description: "Mise en relation entre entreprises et secrétaires qualifiées.",
  },
  metadataBase: new URL("https://secretariatpro-drab.vercel.app"),
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
        <OrganizationJsonLd />
        <WebSiteJsonLd />
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
