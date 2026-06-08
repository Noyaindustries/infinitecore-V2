import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, Urbanist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

/**
 * Favicons : fichiers PNG servis tels quels depuis `/public`.
 * Les routes dynamiques `icon.tsx` / `apple-icon.tsx` (ImageResponse + Satori)
 * pouvaient rendre un carré entièrement noir avec le logo en data-URL.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.infinitecore.net"),
  title: {
    default: "Infinite Core — ERP, CRM et applications métier pour l'Afrique",
    template: "%s | Infinite Core",
  },
  description:
    "Licences et abonnements en FCFA : ERP multi-école, caisse, immobilier, stock, CRM boutique, clinique en ligne. Paiement sécurisé, déploiement rapide.",
  openGraph: {
    locale: "fr_FR",
    type: "website",
    siteName: "Infinite Core",
    images: [{ url: "/infinite-core-logo-v2.png", width: 512, height: 512, alt: "Infinite Core" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinite Core — Applications métier Afrique",
    description: "ERP, CRM et solutions sectorielles. Licences et abonnements en FCFA.",
    images: ["/infinite-core-logo-v2.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/infinite-core-logo.png", type: "image/png", sizes: "32x32" },
      { url: "/infinite-core-logo.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/infinite-core-logo.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${urbanist.variable} ${cormorant.variable} ${dmMono.variable}`}>
      <body className={`${urbanist.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
