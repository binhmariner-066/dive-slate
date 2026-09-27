export const SAC_LOG_KEY = "sac-cal-v1";
export const DIVE_SLATE_STORAGE = "dive-slate-v1";

export type SacRun = {
  id: string;
  date: string;
  working: string;
  resting: string;
};

export type SacResult = {
  ata: number;
  psiUsed: number;
  psiPerMin: number;
  cuftPerMin: number;
};

/** Sheet sample. Orange cells are the inputs; the log is the running average. */
export const SEED_RUNS: SacRun[] = [
  { id: "r1", date: "2026-01-17", working: "0.67", resting: "0" },
  { id: "r2", date: "2026-01-17", working: "0.62", resting: "0" },
  { id: "r3", date: "2026-01-25", working: "0.59", resting: "0" },
  { id: "r4", date: "2026-01-25", working: "0.57", resting: "0" },
  { id: "r5", date: "2026-08-22", working: "0.64", resting: "0" },
  { id: "r6", date: "2025-11-27", working: "0.53", resting: "0" },
  { id: "r7", date: "2025-12-07", working: "0.82", resting: "0" },
  { id: "r8", date: "2025-12-21", working: "0.55", resting: "0" },
  { id: "r9", date: "2026-01-10", working: "0.64", resting: "0" },
  { id: "r10", date: "2026-01-10", working: "0.60", resting: "0" },
];

export function sacRun(input: {
  depth: number;
  minutes: number;
  startPsi: number;
  endPsi: number;
  capacity: number;
  fullPsi: number;
}): SacResult | null {
  if (!(input.minutes > 0) || !(input.fullPsi > 0) || !(input.capacity > 0)) return null;
  if (!(input.depth > -33)) return null;
  const ata = (input.depth + 33) / 33;
  if (!(ata > 0)) return null;
  const psiUsed = input.startPsi - input.endPsi;
  const psiPerMin = psiUsed / input.minutes / ata;
  const cuftPerMin = psiPerMin / (input.fullPsi / input.capacity);
  if (!Number.isFinite(cuftPerMin)) return null;
  return { ata, psiUsed, psiPerMin, cuftPerMin };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Excel AVERAGE: blanks skipped, zeros count. */
export function averageOf(values: string[]): number | null {
  const nums = values
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return round3(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

export function loadRuns(): SacRun[] {
  if (typeof localStorage === "undefined") return SEED_RUNS;
  try {
    const raw = localStorage.getItem(SAC_LOG_KEY);
    if (!raw) return SEED_RUNS;
    const parsed = JSON.parse(raw) as SacRun[];
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_RUNS;
    return parsed.filter((run) => run && typeof run.id === "string");
  } catch {
    return SEED_RUNS;
  }
}
