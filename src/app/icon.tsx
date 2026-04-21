import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

/** Favicon onglet : logo marketing + disque bordure champagne (lisible même petit). */
export default function Icon() {
  const filePath = join(process.cwd(), "public", "infinite-core-logo.png");
  const src = `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 96,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06080D",
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 43,
            border: "3px solid #C9A962",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#06080D",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
          <img src={src} alt="" width={76} height={76} style={{ objectFit: "contain" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
