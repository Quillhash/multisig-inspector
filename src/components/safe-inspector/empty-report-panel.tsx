import { cn } from "@/lib/utils/cn";

type EmptyReportPanelProps = {
  scanning?: boolean;
  scanAddress?: string;
};

function shortenAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length < 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function EmptyReportPanel({
  scanning = false,
  scanAddress = "",
}: EmptyReportPanelProps) {
  if (scanning) {
    return (
      <section className="glass-panel flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-[12px] border px-6 py-10 text-center">
        <div className="scan-orb relative mb-1 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-rule bg-accent-soft text-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 3v3M12 18v3M3 12h3M18 12h3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="text-[1.0625rem] font-semibold tracking-tight">
          Scanning configuration
        </h2>
        <p className="max-w-[22rem] text-[0.875rem] leading-relaxed text-muted">
          Reading owners, threshold, modules, guard, and singleton via direct RPC…
        </p>
        {scanAddress.trim() ? (
          <p className="font-mono text-[0.8125rem] text-muted-faint">
            {shortenAddress(scanAddress)}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="glass-panel flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-[12px] border px-6 py-10 text-center">
      <div
        className={cn(
          "mb-1 grid h-14 w-14 place-items-center rounded-[12px] border border-dashed border-rule-strong",
          "bg-background text-muted-faint",
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 12v9M12 12L4 7.5M12 12l8-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <h2 className="text-[1.0625rem] font-semibold tracking-tight">
        Awaiting target
      </h2>
      <p className="max-w-[22rem] text-[0.875rem] leading-relaxed text-muted">
        Paste a Safe address or URL, then scan to generate an on-chain security
        report.
      </p>
    </section>
  );
}
