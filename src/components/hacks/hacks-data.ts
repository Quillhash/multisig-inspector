import rawHacks from "@/data/hacks.json";

export type HelpVerdict = "yes" | "partially" | "no";

export type HackIncident = {
  id: string;
  name: string;
  date: string;
  lossDisplay: string;
  lossUsd: number;
  vector: string;
  verdict: HelpVerdict;
  verdictCopy: string;
};

export const HACKS: HackIncident[] = rawHacks as HackIncident[];

export function totalLossUsd(): number {
  return HACKS.reduce((sum, hack) => sum + hack.lossUsd, 0);
}

export function verdictCounts(): Record<HelpVerdict, number> {
  return HACKS.reduce(
    (acc, hack) => {
      acc[hack.verdict] += 1;
      return acc;
    },
    { yes: 0, partially: 0, no: 0 },
  );
}

export function groupByYear(incidents: HackIncident[]): [string, HackIncident[]][] {
  const map = new Map<string, HackIncident[]>();
  for (const incident of incidents) {
    const year = incident.date.slice(0, 4);
    const group = map.get(year) ?? [];
    group.push(incident);
    map.set(year, group);
  }
  return Array.from(map.entries()).sort(([a], [b]) => Number(b) - Number(a));
}

export function formatUsdCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  return `$${value.toLocaleString()}`;
}
