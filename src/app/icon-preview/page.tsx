/**
 * Page de prévisualisation des variantes de favicon — outil interne (non indexé).
 * Affiche chaque variante à 3 tailles (128, 32, 16 px) pour juger la lisibilité dans la barre d'onglets.
 * À ouvrir sur http://localhost:3000/icon-preview
 */

import type { CSSProperties } from "react";

const LOGO = "/infinite-core-logo.png";

type Variant = {
  id: string;
  label: string;
  description: string;
  container: CSSProperties;
  img?: CSSProperties;
  /** Éléments décoratifs additionnels rendus sous le logo (ex. halos). */
  decoration?: React.ReactNode;
};

const VARIANTS: Variant[] = [
  {
    id: "actuel",
    label: "Actuel — noir plein",
    description:
      "Fond noir identique au header. Carré plein, PNG à taille réelle — sobre mais le logo peut se fondre dans les onglets sombres.",
    container: { background: "#000000" },
  },
  {
    id: "gradient-brand",
    label: "Dégradé marque",
    description:
      "Diagonale bleu marine → orange cuivré, les deux teintes signature. Logo contrasté sur les deux extrêmes, identité forte.",
    container: {
      background: "linear-gradient(135deg, #2B547E 0%, #D98A2C 100%)",
    },
  },
  {
    id: "orange-solid",
    label: "Orange plein",
    description:
      "Couleur champagne cuivrée du brand. Maximise la visibilité dans un onglet — pastille chaude qui ressort sur un bandeau de favicons noirs ou blancs.",
    container: { background: "#D98A2C" },
  },
  {
    id: "halo-orange",
    label: "Halo orange sur noir",
    description:
      "Fond noir + disque radial orange doux derrière le logo. Pour garder le look homepage mais rendre le logo lisible.",
    container: {
      background:
        "radial-gradient(circle at 50% 50%, rgba(217,138,44,0.55) 0%, rgba(217,138,44,0.18) 45%, #000000 75%)",
    },
  },
  {
    id: "cercle-champagne",
    label: "Cercle champagne",
    description:
      "Fond clair, cercle parfait + bordure orange. Très lisible sur onglets clairs comme sombres, style badge premium.",
    container: {
      background: "#F5F0E4",
      borderRadius: "50%",
      border: "5px solid #D98A2C",
      boxSizing: "border-box",
    },
    img: { width: "72%", height: "72%" },
  },
  {
    id: "blue-deep",
    label: "Bleu nuit",
    description:
      "Fond `#2B547E` (bleu marine du brand). Sombre mais moins noir que #000, le logo y ressort nettement sans sortir de la palette.",
    container: { background: "#2B547E" },
  },
];

function Preview({ variant, size }: { variant: Variant; size: number }) {
  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
    ...variant.container,
  };
  const imgStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    ...(variant.img || {}),
  };
  return (
    <div style={rootStyle}>
      {variant.decoration}
      {/* eslint-disable-next-line @next/next/no-img-element -- preview locale, pas besoin de next/image */}
      <img src={LOGO} alt="" style={imgStyle} />
    </div>
  );
}

export default function IconPreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0E18",
        color: "#F5F7FF",
        fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "#8E9EAE",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            Interne — non indexé
          </p>
          <h1 style={{ margin: "6px 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Prévisualisation des favicons Infinite Core
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#8E9EAE", maxWidth: 640, lineHeight: 1.55 }}>
            Chaque variante est rendue à <strong style={{ color: "#F5F7FF" }}>128 px</strong> (home‑screen iOS),
            <strong style={{ color: "#F5F7FF" }}> 32 px</strong> (onglet Chrome) et
            <strong style={{ color: "#F5F7FF" }}> 16 px</strong> (onglet compact / barre de favoris). Regarde à la
            taille <em>16 px</em> — c'est le test qui compte.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {VARIANTS.map((variant) => (
            <article
              key={variant.id}
              style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: 16,
                  borderRadius: 12,
                  background:
                    "repeating-conic-gradient(#0f1524 0% 25%, #161c2e 0% 50%) 0 0 / 16px 16px",
                }}
              >
                <Preview variant={variant} size={128} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <Preview variant={variant} size={32} />
                  <span style={{ fontSize: 9, color: "#8E9EAE", letterSpacing: "0.1em" }}>32 px</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <Preview variant={variant} size={16} />
                  <span style={{ fontSize: 9, color: "#8E9EAE", letterSpacing: "0.1em" }}>16 px</span>
                </div>
              </div>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>{variant.label}</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#8E9EAE", lineHeight: 1.55 }}>{variant.description}</p>
                <code
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    fontSize: 10,
                    color: "#D98A2C",
                    background: "rgba(217,138,44,0.08)",
                    border: "1px solid rgba(217,138,44,0.2)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    letterSpacing: "0.08em",
                  }}
                >
                  id: {variant.id}
                </code>
              </div>
            </article>
          ))}
        </section>

        <footer style={{ marginTop: 40, padding: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#8E9EAE", lineHeight: 1.6 }}>
            Dis‑moi juste <em>&laquo; adopte la variante X &raquo;</em> (par exemple <code style={{ color: "#F5F7FF" }}>halo-orange</code> ou <code style={{ color: "#F5F7FF" }}>cercle-champagne</code>) et je mets à jour <code style={{ color: "#F5F7FF" }}>src/app/icon.tsx</code> et <code style={{ color: "#F5F7FF" }}>src/app/apple-icon.tsx</code> avec les valeurs exactes.
          </p>
        </footer>
      </div>
    </main>
  );
}
