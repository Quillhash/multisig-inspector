import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** Social share image (1200x630), generated at build time. */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#fff",
          background:
            "radial-gradient(900px 420px at 12% -8%, rgba(45,91,255,0.55), transparent 62%), radial-gradient(600px 360px at 95% 0%, rgba(20,184,166,0.28), transparent 60%), #070b18",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#103DD3" />
            <circle cx="14" cy="14" r="6.5" stroke="#fff" strokeWidth="2.5" />
            <path d="M18.5 18.5L24.5 24.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600 }}>Multisig Inspector</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.04, letterSpacing: -3 }}>
            Check any Safe multisig before you sign
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.72)" }}>
            Free, read-only configuration scan and transaction hash verification.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.6)" }}>by QuillAudits</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
