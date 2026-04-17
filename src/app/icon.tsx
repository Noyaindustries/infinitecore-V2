import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  // Version carrée pré-cropée (générée par `scripts/make-icon-crop.ps1`) :
  // contient uniquement le symbole d'infini, pas le texte "Infinite CORE"
  // qui serait de toute façon illisible à 16/32 px.
  const filePath = join(process.cwd(), "public", "infinite-core-icon.png");
  const src = `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2B547E",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img
          src={src}
          alt=""
          width={96}
          height={96}
          style={{ objectFit: "cover" }}
        />
      </div>
    ),
    { ...size },
  );
}
