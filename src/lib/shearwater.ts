export type LoggedDive = {
  id: string;
  number: number;
  product: string;
  serial: string;
  start: string;
  gfLow: number;
  gfHigh: number;
  imperial: boolean;
  maxDepth: number;
  minutes: number;
  avgDepth: number;
  cnsEnd: number;
  fo2: number;
  ndl: number | null;
  ndlCapped: boolean;
  tempLow: number | null;
  tempHigh: number | null;
  aiOff: boolean;
  profile: [number, number][];
};

export const SHEARWATER_KEY = "shearwater-log-v1";

/** Perdix dive 187, exported from Shearwater Cloud on 22 Aug 2026. */
export const SEED_DIVE: LoggedDive = {
  id: "330E38DC-187",
  number: 187,
  product: "Perdix",
  serial: "330E38DC",
  start: "8/22/2026 6:43:22 AM",
  gfLow: 40,
  gfHigh: 80,
  imperial: true,
  maxDepth: 49.3,
  minutes: 75,
  avgDepth: 30.7,
  cnsEnd: 1,
  fo2: 0.21,
  ndl: 99,
  ndlCapped: true,
  tempLow: 65,
  tempHigh: 73,
  aiOff: true,
  profile: [
    [0, 0],
    [120, 18.4],
    [480, 18.7],
    [960, 21.8],
    [1440, 30.3],
    [1920, 37.9],
    [2400, 46.1],
    [2760, 49],
    [2860, 49.1],
    [3240, 39.9],
    [3720, 29.9],
    [4200, 21.3],
    [4560, 0],
  ],
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function num(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseShearwaterCsv(text: string): LoggedDive | null {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const headerAt = rows.findIndex((row) => row[0]?.trim() === "Dive Number");
  if (headerAt < 0 || !rows[headerAt + 1] || !rows[headerAt + 2]) return null;
  const metaHead = rows[headerAt];
  const metaRow = rows[headerAt + 1];
  const meta: Record<string, string> = {};
  metaHead.forEach((name, i) => {
    meta[name.trim()] = metaRow[i] ?? "";
  });
  const sampleHead = rows[headerAt + 2];
  if (sampleHead[0]?.trim() !== "Time (sec)") return null;
  const col = (name: string) => sampleHead.findIndex((item) => item.trim() === name);
  const timeI = col("Time (sec)");
  const depthI = col("Depth");
  const ndlI = col("Current NDL");
  const fo2I = col("Fraction O2");
  const tempI = col("Water Temp");
  const tankI = col("Tank 1 pressure (PSI)");
  if (timeI < 0 || depthI < 0) return null;

  const samples = rows.slice(headerAt + 3);
  let depthSum = 0;
  let depthCount = 0;
  let minNdl: number | null = null;
  let fo2: number | null = null;
  let tempLow: number | null = null;
  let tempHigh: number | null = null;
  let aiOff = false;
  let maxSample = 0;
  let maxAt = 0;
  const raw: [number, number][] = [];
  for (const sample of samples) {
    const time = num(sample[timeI]);
    const depth = num(sample[depthI]);
    if (time == null || depth == null) continue;
    raw.push([time, depth]);
    if (depth > maxSample) {
      maxSample = depth;
      maxAt = time;
    }
    if (depth > 1) {
      depthSum += depth;
      depthCount++;
      const ndl = ndlI >= 0 ? num(sample[ndlI]) : null;
      if (ndl != null) minNdl = minNdl == null ? ndl : Math.min(minNdl, ndl);
      if (fo2 == null && fo2I >= 0) fo2 = num(sample[fo2I]);
      const temp = tempI >= 0 ? num(sample[tempI]) : null;
      if (temp != null) {
        tempLow = tempLow == null ? temp : Math.min(tempLow, temp);
        tempHigh = tempHigh == null ? temp : Math.max(tempHigh, temp);
      }
    }
    if (tankI >= 0 && /AI is off/i.test(sample[tankI] ?? "")) aiOff = true;
  }
  if (!raw.length) return null;

  const maxTime = num(meta["Max Time"]);
  const minutes =
    maxTime == null ? Math.round(raw[raw.length - 1][0] / 60) : maxTime > 300 ? Math.round(maxTime / 60) : Math.round(maxTime);
  const maxDepth = num(meta["Max Depth"]) ?? maxSample;
  const gfLow = num(meta["GF Minimum"]) ?? 30;
  const gfHigh = num(meta["GF Maximum"]) ?? 70;
  const serial = meta["Computer Serial Number"] || "perdix";
  const number = num(meta["Dive Number"]) ?? 0;
  const step = Math.max(1, Math.ceil(raw.length / 36));
  const profile: [number, number][] = [];
  raw.forEach((point, i) => {
    if (i % step === 0) profile.push([point[0], Math.round(point[1] * 10) / 10]);
  });
  if (!profile.some((point) => point[0] === maxAt)) profile.push([maxAt, Math.round(maxSample * 10) / 10]);
  profile.sort((a, b) => a[0] - b[0]);
  const lastDeep = [...raw].reverse().find((point) => point[1] > 1);
  const end = lastDeep ? lastDeep[0] + 60 : raw[raw.length - 1][0];
  const trimmed = profile.filter((point) => point[0] <= end);
  if (trimmed.length && trimmed[trimmed.length - 1][1] > 0) trimmed.push([end, 0]);

  return {
    id: `${serial}-${number}`,
    number,
    product: meta["Product"] || "Perdix",
    serial,
    start: meta["Start Date"] || "",
    gfLow,
    gfHigh,
    imperial: /^true$/i.test(meta["Imperial Units"] ?? "True"),
    maxDepth,
    minutes,
    avgDepth: depthCount ? Math.round((depthSum / depthCount) * 10) / 10 : maxDepth,
    cnsEnd: num(meta["End CNS"]) ?? 0,
    fo2: fo2 ?? 0.21,
    ndl: minNdl,
    ndlCapped: minNdl != null && minNdl >= 99,
    tempLow,
    tempHigh,
    aiOff,
    profile: trimmed.length ? trimmed : profile,
  };
}

export function formatDiveWhen(start: string): string {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return start;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function gasName(fo2: number): string {
  if (fo2 >= 0.34 && fo2 < 0.38) return "EAN 36";
  if (fo2 >= 0.3 && fo2 < 0.34) return "EAN 32";
  if (Math.abs(fo2 - 0.21) < 0.02) return "Air";
  return `${Math.round(fo2 * 100)}%`;
}
