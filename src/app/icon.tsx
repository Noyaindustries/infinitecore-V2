import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
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
          border: "5px solid #D98A2C",
          boxSizing: "border-box",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img
          src={src}
          alt=""
          width={72}
          height={72}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size },
  );
}
