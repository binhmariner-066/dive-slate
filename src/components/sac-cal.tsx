import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { TANKS } from "@/lib/engine";
import { SAC_LOG_KEY, SEED_RUNS, averageOf, loadRuns, round2, sacRun, type SacRun } from "@/lib/sac";

type Entry = {
  tank: string;
  depth: string;
  minutes: string;
  startPsi: string;
  endPsi: string;
  capacity: string;
  fullPsi: string;
  kind: "working" | "resting";
};

const ENTRY: Entry = {
  tank: "custom",
  depth: "31",
  minutes: "75",
  startPsi: "3200",
  endPsi: "500",
  capacity: "120",
  fullPsi: "3500",
  kind: "working",
};

function fillForTank(name: string): { capacity: string; fullPsi: string } | null {
  const row = TANKS.find((tank) => tank.name === name);
  if (!row) return null;
  const fullPsi = name.startsWith("HP") ? 3500 : name.startsWith("LP") ? 2640 : 3000;
  const capacity = Math.round(row.single * (fullPsi / 100) * 10) / 10;
  return { capacity: String(capacity), fullPsi: String(fullPsi) };
}

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function today(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function SacPanel({ onAverage }: { onAverage: (sac: string) => void }) {
  const [entry, setEntry] = useState<Entry>(ENTRY);
  const [runs, setRuns] = useState<SacRun[]>(SEED_RUNS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRuns(loadRuns());
    setReady(true);
  }, []);

  const workingAvg = useMemo(() => averageOf(runs.map((run) => run.working)), [runs]);
  const restingAvg = useMemo(() => averageOf(runs.map((run) => run.resting)), [runs]);

  useEffect(() => {
    if (!ready || workingAvg == null) return;
    localStorage.setItem(SAC_LOG_KEY, JSON.stringify(runs));
    onAverage(workingAvg.toFixed(3));
  }, [ready, runs, workingAvg, onAverage]);

  const result = useMemo(() => {
    const depth = parseNum(entry.depth);
    const minutes = parseNum(entry.minutes);
    const startPsi = parseNum(entry.startPsi);
    const endPsi = parseNum(entry.endPsi);
    const capacity = parseNum(entry.capacity);
    const fullPsi = parseNum(entry.fullPsi);
    if (
      depth == null ||
      minutes == null ||
      startPsi == null ||
      endPsi == null ||
      capacity == null ||
      fullPsi == null
    ) {
      return null;
    }
    return sacRun({ depth, minutes, startPsi, endPsi, capacity, fullPsi });
  }, [entry]);

  function patch(partial: Partial<Entry>) {
    setEntry((prev) => ({ ...prev, ...partial }));
  }

  function bump(key: "depth" | "minutes" | "startPsi" | "endPsi" | "capacity" | "fullPsi", delta: number) {
    setEntry((prev) => {
      const current = parseNum(prev[key]) ?? 0;
      return {
        ...prev,
        ...(key === "capacity" || key === "fullPsi" ? { tank: "custom" as const } : {}),
        [key]: String(Math.max(0, Math.round((current + delta) * 100) / 100)),
      };
    });
  }

  function chooseTank(name: string) {
    const filled = fillForTank(name);
    setEntry((prev) => ({ ...prev, tank: name, ...(filled ?? {}) }));
  }

  function addRun() {
    if (!result) return;
    const rate = round2(result.cuftPerMin).toFixed(2);
    const run: SacRun = {
      id: crypto.randomUUID(),
      date: today(),
      working: entry.kind === "working" ? rate : "",
      resting: entry.kind === "resting" ? rate : "",
    };
    setRuns((prev) => [run, ...prev]);
  }

  function updateRun(id: string, partial: Partial<SacRun>) {
    setRuns((prev) => prev.map((run) => (run.id === id ? { ...run, ...partial } : run)));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">SAC CAL</h2>
        <p className="mt-1 text-sm text-mist">Enter the dive. Add it and the gas tab SAC rate follows the working average.</p>
        <label className="mt-3 block">
          <span className="text-xs font-medium tracking-wide text-mist uppercase">Tank</span>
          <select
            value={entry.tank}
            onChange={(event) => chooseTank(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-2xl border border-gold/50 bg-water px-3 text-base text-ink"
          >
            <option value="custom">Custom</option>
            {TANKS.map((tank) => (
              <option key={tank.name} value={tank.name}>
                {tank.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Depth" value={entry.depth} suffix="fsw" onChange={(depth) => patch({ depth })} onDec={() => bump("depth", -1)} onInc={() => bump("depth", 1)} />
          <Field label="Time" value={entry.minutes} suffix="min" onChange={(minutes) => patch({ minutes })} onDec={() => bump("minutes", -1)} onInc={() => bump("minutes", 1)} />
          <Field label="Start pressure" value={entry.startPsi} suffix="psi" onChange={(startPsi) => patch({ startPsi })} onDec={() => bump("startPsi", -100)} onInc={() => bump("startPsi", 100)} />
          <Field label="End pressure" value={entry.endPsi} suffix="psi" onChange={(endPsi) => patch({ endPsi })} onDec={() => bump("endPsi", -100)} onInc={() => bump("endPsi", 100)} />
          <Field label="Tank capacity" value={entry.capacity} suffix="cu ft" onChange={(capacity) => patch({ capacity, tank: "custom" })} onDec={() => bump("capacity", -1)} onInc={() => bump("capacity", 1)} />
          <Field label="Full pressure" value={entry.fullPsi} suffix="psi" onChange={(fullPsi) => patch({ fullPsi, tank: "custom" })} onDec={() => bump("fullPsi", -100)} onInc={() => bump("fullPsi", 100)} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Depth in ATA" value={result ? result.ata.toFixed(2) : "—"} />
          <Stat label="PSI used" value={result ? String(Math.round(result.psiUsed)) : "—"} />
          <Stat label="SAC psi/min" value={result ? result.psiPerMin.toFixed(2) : "—"} />
          <Stat label="SAC cu ft/min" value={result ? round2(result.cuftPerMin).toFixed(2) : "—"} strong />
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line bg-water p-1">
            {(["working", "resting"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => patch({ kind })}
                className={
                  "min-h-11 rounded-full px-3 text-sm font-medium capitalize " +
                  (entry.kind === kind ? "bg-panel-2 text-ink" : "text-mist")
                }
              >
                {kind}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!result}
            onClick={addRun}
            className="min-h-11 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink disabled:opacity-40"
          >
            Add {result ? round2(result.cuftPerMin).toFixed(2) : "dive"}
          </button>
        </div>
      </section>

      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Running average</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-water px-4 py-3">
            <p className="text-xs tracking-wide text-mist uppercase">Working</p>
            <p className="mt-1 font-mono text-4xl text-gold tabular-nums">{workingAvg == null ? "—" : workingAvg.toFixed(3)}</p>
            <p className="mt-1 text-sm text-mist">Gas tab SAC rate</p>
          </div>
          <div className="rounded-2xl border border-line bg-water px-4 py-3">
            <p className="text-xs tracking-wide text-mist uppercase">Resting</p>
            <p className="mt-1 font-mono text-4xl tabular-nums">{restingAvg == null ? "—" : restingAvg.toFixed(3)}</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {runs.map((run) => (
            <li key={run.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
              <input
                type="date"
                value={run.date}
                onChange={(event) => updateRun(run.id, { date: event.target.value })}
                className="col-span-3 min-h-11 min-w-0 rounded-xl border border-line bg-water px-2 font-mono text-sm text-ink [color-scheme:dark] sm:col-span-1"
              />
              <input
                inputMode="decimal"
                aria-label={`Working SAC ${run.date}`}
                placeholder="Working"
                value={run.working}
                onChange={(event) => updateRun(run.id, { working: event.target.value })}
                className="min-h-11 min-w-0 rounded-xl border border-gold/50 bg-water px-2 font-mono text-sm text-ink"
              />
              <input
                inputMode="decimal"
                aria-label={`Resting SAC ${run.date}`}
                placeholder="Resting"
                value={run.resting}
                onChange={(event) => updateRun(run.id, { resting: event.target.value })}
                className="min-h-11 min-w-0 rounded-xl border border-gold/50 bg-water px-2 font-mono text-sm text-ink"
              />
              <button
                type="button"
                aria-label={`Remove run ${run.date}`}
                onClick={() => setRuns((prev) => prev.filter((item) => item.id !== run.id))}
                className="grid size-11 place-items-center rounded-xl border border-line text-mist"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-mist uppercase">{label}</p>
      <p className={"mt-1 font-mono text-xl tabular-nums " + (strong ? "text-gold" : "text-ink")}>{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  suffix,
  onChange,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium tracking-wide text-mist uppercase">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <Nudge label={`Decrease ${label}`} onClick={onDec}>
          <Minus className="size-4" />
        </Nudge>
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-2xl border border-gold/50 bg-water px-3">
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full min-w-0 bg-transparent font-mono text-lg text-ink tabular-nums outline-none"
          />
          <span className="shrink-0 text-sm text-mist">{suffix}</span>
        </div>
        <Nudge label={`Increase ${label}`} onClick={onInc}>
          <Plus className="size-4" />
        </Nudge>
      </div>
    </div>
  );
}

function Nudge({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-panel text-ink"
    >
      {children}
    </button>
  );
}
