import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Navbar from "@/components/Navbar"; // ⬅️ Ajoute l'import ici
import PWAInit from "@/components/PWAInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SecrétariatPro - Votre assistant en un clic",
  description: "Mise en relation entre entreprises et secrétaires qualifiées.",
  applicationName: "SecrétariatPro",
  appleWebApp: {
    capable: true,
    title: "SecrétariatPro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
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
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased selection:bg-blue-500 selection:text-white bg-slate-50 text-slate-900`}>
        <Navbar /> {/* ⬅️ On place la Navbar juste au dessus du contenu */}
        <PWAInit />
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