import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, Urbanist } from "next/font/google";
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

/** Favicons : cercle + contour doré via `icon.tsx` / `apple-icon.tsx`. */
export const metadata: Metadata = {
  title: "Infinite Core | The Operating System for African Business",
  description:
    "Infinite Core unifie CRM, Finance, RH et Projets dans un système unique modulaire pour propulser les entreprises africaines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${urbanist.variable} ${cormorant.variable} ${dmMono.variable}`}>
      <body className={`${urbanist.className} antialiased`}>{children}</body>
    </html>
  );
}
