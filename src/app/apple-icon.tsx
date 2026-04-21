import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône « Ajouter à l’écran d’accueil » : même logo + cercle bordure champagne. */
export default function AppleIcon() {
  const filePath = join(process.cwd(), "public", "infinite-core-logo.png");
  const src = `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06080D",
        }}
      >
        <div
          style={{
            width: 164,
            height: 164,
            borderRadius: 82,
            border: "4px solid #C9A962",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#06080D",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
          <img src={src} alt="" width={148} height={148} style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
