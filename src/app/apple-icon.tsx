import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const filePath = join(process.cwd(), "public", "infinite-core-logo.png");
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
          background: "#050816",
          borderRadius: "50%",
          border: "8px solid #E8961E",
          boxSizing: "border-box",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img
          src={src}
          alt=""
          width={132}
          height={132}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size },
  );
}
