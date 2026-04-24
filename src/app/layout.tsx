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
  title: "Infinite Core | The Operating System for African Business",
  description:
    "Infinite Core unifie CRM, Finance, RH et Projets dans un système unique modulaire pour propulser les entreprises africaines.",
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
