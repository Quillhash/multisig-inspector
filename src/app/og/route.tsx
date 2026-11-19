import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const asset = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts));

/** Social share image (1200x630) in the QuillAudits style, generated at build time. */
export function GET() {
  // The official white logo file, embedded as is.
  const logo = `data:image/svg+xml;base64,${asset("public", "branding", "quillaudits-logo-white.svg").toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 72px 0",
          color: "#FFFBFF",
          background: "#103DD3",
          fontFamily: "Bai Jamjuree",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={300} height={50} alt="QuillAudits" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontFamily: "Chakra Petch", fontSize: 28, color: "#EEEEEE" }}>
            MULTISIG INSPECTOR
          </div>
          <div style={{ display: "flex", fontFamily: "Chakra Petch", fontSize: 84, lineHeight: 1.1 }}>
            CHECK ANY SAFE MULTISIG BEFORE YOU SIGN.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#EEEEEE" }}>
            Free, read-only configuration scan and transaction hash verification.
          </div>
        </div>
        <div style={{ display: "flex", height: 32, margin: "0 -72px", background: "#28C6FF" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Chakra Petch", data: asset("src", "app", "og", "fonts", "chakra-petch-700.ttf"), weight: 700, style: "normal" },
        { name: "Bai Jamjuree", data: asset("src", "app", "og", "fonts", "bai-jamjuree-500.ttf"), weight: 500, style: "normal" },
      ],
    },
  );
}
