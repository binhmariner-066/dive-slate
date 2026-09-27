import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, Gauge, Minus, Plus, RotateCcw, Timer, Watch } from "lucide-react";
import {
  GF_PRESETS,
  MIX_LABEL,
  TANKS,
  computePlan,
  formatClock,
  type GasInput,
  type GfPreset,
  type MixId,
  type PlanOutput,
  type Units,
} from "@/lib/engine";
import { DIVE_SLATE_STORAGE, averageOf, loadRuns } from "@/lib/sac";
import { MIXES } from "@/lib/naui-data";
import { SacPanel } from "@/components/sac-cal";
import {
  SEED_DIVE,
  SHEARWATER_KEY,
  formatDiveWhen,
  gasName,
  parseShearwaterCsv,
  type LoggedDive,
} from "@/lib/shearwater";

type Tab = "plan" | "gas" | "computer" | "sac";

type Draft = {
  mix: MixId;
  units: Units;
  depths: [string, string, string];
  times: [string, string, string];
  sitH: [string, string];
  sitM: [string, string];
  sac: string;
  tank: string;
  twin: boolean;
  startPsi: string;
  divide: 2 | 3;
  chain: boolean;
  stopMin: number;
  gf: GfPreset;
  gfLow: string;
  gfHigh: string;
};

const STORAGE = DIVE_SLATE_STORAGE;

const DEFAULTS: Draft = {
  mix: "air",
  units: "FSW",
  depths: ["60", "50", "40"],
  times: ["35", "20", "25"],
  sitH: ["1", "1"],
  sitM: ["0", "30"],
  sac: "0.63",
  tank: "HP 120",
  twin: false,
  startPsi: "3400",
  divide: 2,
  chain: false,
  stopMin: 0,
  gf: "med",
  gfLow: "40",
  gfHigh: "85",
};

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      ...DEFAULTS,
      ...parsed,
      depths: parsed.depths ?? DEFAULTS.depths,
      times: parsed.times ?? DEFAULTS.times,
      sitH: parsed.sitH ?? DEFAULTS.sitH,
      sitM: parsed.sitM ?? DEFAULTS.sitM,
    };
  } catch {
    return DEFAULTS;
  }
}

export function DiveSlate() {
  const [tab, setTab] = useState<Tab>("plan");
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadDraft();
    const avg = averageOf(loadRuns().map((run) => run.working));
    setDraft(avg == null ? loaded : { ...loaded, sac: avg.toFixed(3) });
    setReady(true);
  }, []);

  const applySac = useCallback((sac: string) => {
    setDraft((prev) => (prev.sac === sac ? prev : { ...prev, sac }));
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE, JSON.stringify(draft));
  }, [draft, ready]);

  const preset = GF_PRESETS.find((p) => p.id === draft.gf) ?? GF_PRESETS[1]!;
  const gfHigh = draft.gf === "custom" ? (parseNum(draft.gfHigh) ?? preset.high) : preset.high;
  const gfLow = draft.gf === "custom" ? (parseNum(draft.gfLow) ?? preset.low) : preset.low;

  const plan = useMemo(() => {
    const gasInput: GasInput = {
      sac: parseNum(draft.sac) ?? 0,
      tank: draft.tank,
      twin: draft.twin,
      startPsi: parseNum(draft.startPsi) ?? 0,
      divide: draft.divide,
      chain: draft.chain,
      stopMin: draft.stopMin,
    };
    return computePlan({
      mix: draft.mix,
      units: draft.units,
      depths: draft.depths.map(parseNum),
      times: draft.times.map(parseNum),
      sits: [0, 1].map((i) => {
        const h = parseNum(draft.sitH[i] ?? "");
        const m = parseNum(draft.sitM[i] ?? "");
        if (h == null && m == null) return null;
        return (h ?? 0) * 60 + (m ?? 0);
      }),
      gas: gasInput,
      gfHigh,
    });
  }, [draft, gfHigh]);

  function patch(partial: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function setDepth(i: number, value: string) {
    setDraft((prev) => {
      const depths = [...prev.depths] as Draft["depths"];
      depths[i] = value;
      return { ...prev, depths };
    });
  }

  function setTime(i: number, value: string) {
    setDraft((prev) => {
      const times = [...prev.times] as Draft["times"];
      times[i] = value;
      return { ...prev, times };
    });
  }

  function bump(list: "depths" | "times", i: number, delta: number) {
    setDraft((prev) => {
      const next = [...prev[list]] as Draft["depths"];
      const current = parseNum(next[i] ?? "") ?? 0;
      next[i] = String(Math.max(0, current + delta));
      return { ...prev, [list]: next };
    });
  }

  function setSit(i: number, part: "h" | "m", value: string) {
    setDraft((prev) => {
      if (part === "h") {
        const sitH = [...prev.sitH] as Draft["sitH"];
        sitH[i] = value;
        return { ...prev, sitH };
      }
      const sitM = [...prev.sitM] as Draft["sitM"];
      sitM[i] = value;
      return { ...prev, sitM };
    });
  }

  function bumpSit(i: number, part: "h" | "m", delta: number) {
    setDraft((prev) => {
      const sitH = [...prev.sitH] as Draft["sitH"];
      const sitM = [...prev.sitM] as Draft["sitM"];
      let hours = parseNum(sitH[i] ?? "") ?? 0;
      let minutes = parseNum(sitM[i] ?? "") ?? 0;
      if (part === "h") {
        hours = Math.max(0, hours + delta);
      } else {
        minutes += delta;
        if (minutes >= 60) {
          hours += Math.floor(minutes / 60);
          minutes = minutes % 60;
        } else if (minutes < 0) {
          if (hours > 0) {
            hours -= 1;
            minutes = 60 + minutes;
          } else {
            minutes = 0;
          }
        }
      }
      sitH[i] = String(hours);
      sitM[i] = String(minutes);
      return { ...prev, sitH, sitM };
    });
  }

  return (
    <div className="safe-top min-h-screen bg-water text-ink">
      <header className="mx-auto flex max-w-[96rem] items-end justify-between gap-4 px-4 pt-5 pb-3">
        <div>
          <p className="text-xs font-medium tracking-widest text-teal uppercase">Personal slate</p>
          <h1 className="text-2xl font-semibold text-balance">Dive Slate</h1>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm text-mist"
          onClick={() => patch(DEFAULTS)}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </button>
      </header>

      <div className="mx-auto max-w-[96rem] px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segment
            value={draft.mix}
            options={[
              { id: "air", label: "Air" },
              { id: "ean32", label: "EAN 32" },
              { id: "ean36", label: "EAN 36" },
            ]}
            onChange={(mix) => patch({ mix })}
          />
          <Segment
            value={draft.units}
            options={[
              { id: "FSW", label: "Feet" },
              { id: "MSW", label: "Metres" },
            ]}
            onChange={(units) => patch({ units })}
          />
        </div>
        <p className="mt-3 text-sm text-mist">
          {MIX_LABEL[draft.mix]} · 2020 NAUI tables · planning aid only. A square profile is assumed.
        </p>
      </div>

      <nav className="mx-auto mt-4 flex max-w-[96rem] flex-wrap gap-2 px-4" aria-label="Sections">
        <TabButton active={tab === "gas"} onClick={() => setTab("gas")} icon={<Gauge className="size-4" />} label="Gas" />
        <TabButton active={tab === "plan"} onClick={() => setTab("plan")} icon={<Timer className="size-4" />} label="Tables" />
        <TabButton active={tab === "computer"} onClick={() => setTab("computer")} icon={<Watch className="size-4" />} label="Perdix" />
        <TabButton active={tab === "sac"} onClick={() => setTab("sac")} icon={<Activity className="size-4" />} label="SAC CAL" />
      </nav>

      <main
        className={
          "safe-pad mx-auto mt-4 grid max-w-[96rem] gap-4 px-4 " +
          (tab === "sac" ? "" : "lg:grid-cols-[minmax(0,1fr)_22rem]")
        }
      >
        <section className="flex min-w-0 flex-col gap-4">
          {tab === "plan" && (
            <PlanTab
              draft={draft}
              plan={plan}
              onDepth={setDepth}
              onTime={setTime}
              onBump={bump}
              onSit={setSit}
              onBumpSit={bumpSit}
            />
          )}
          {tab === "gas" && <GasTab draft={draft} plan={plan} onPatch={patch} />}
          {tab === "sac" && <SacPanel onAverage={applySac} />}
          {tab === "computer" && (
            <ComputerTab draft={draft} plan={plan} gfLow={gfLow} gfHigh={gfHigh} onPatch={patch} />
          )}
        </section>
        {tab !== "sac" && (
          <Slate plan={plan} gfLabel={draft.gf === "custom" ? `Custom ${gfLow}/${gfHigh}` : preset.label} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex min-h-11 min-w-[8.5rem] flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium " +
        (active ? "bg-teal text-teal-ink" : "bg-panel text-mist")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-panel p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={
            "min-h-11 rounded-full px-3 text-sm font-medium " +
            (value === option.id ? "bg-panel-2 text-ink" : "text-mist")
          }
        >
          {option.label}
        </button>
      ))}
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
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-2xl border border-line bg-water px-3">
          <input
            inputMode="numeric"
            size={4}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onInc();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                onDec();
              }
            }}
            className="w-full min-w-0 bg-transparent font-mono text-xl text-ink tabular-nums outline-none"
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

function PlanTab({
  draft,
  plan,
  onDepth,
  onTime,
  onBump,
  onSit,
  onBumpSit,
}: {
  draft: Draft;
  plan: PlanOutput;
  onDepth: (i: number, value: string) => void;
  onTime: (i: number, value: string) => void;
  onBump: (list: "depths" | "times", i: number, delta: number) => void;
  onSit: (i: number, part: "h" | "m", value: string) => void;
  onBumpSit: (i: number, part: "h" | "m", delta: number) => void;
}) {
  const unit = draft.units === "MSW" ? "msw" : "ft";
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-w-0 flex-col gap-4">
          {i > 0 && (
            <article className="rounded-card border border-line bg-panel p-4">
              <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Surface interval {i}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field
                  label="Hours"
                  value={draft.sitH[i - 1] ?? ""}
                  suffix="hr"
                  onChange={(value) => onSit(i - 1, "h", value)}
                  onDec={() => onBumpSit(i - 1, "h", -1)}
                  onInc={() => onBumpSit(i - 1, "h", 1)}
                />
                <Field
                  label="Minutes"
                  value={draft.sitM[i - 1] ?? ""}
                  suffix="min"
                  onChange={(value) => onSit(i - 1, "m", value)}
                  onDec={() => onBumpSit(i - 1, "m", -1)}
                  onInc={() => onBumpSit(i - 1, "m", 1)}
                />
              </div>
              <SitReadout sit={plan.sits[i - 1]!} />
            </article>
          )}
          <article className="rounded-card border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">
              Dive {i + 1}
              {i === 0 ? " · first dive" : " · repetitive"}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field
                label="Maximum depth"
                value={draft.depths[i] ?? ""}
                suffix={unit}
                onChange={(value) => onDepth(i, value)}
                onDec={() => onBump("depths", i, -1)}
                onInc={() => onBump("depths", i, 1)}
              />
              <Field
                label="Bottom time"
                value={draft.times[i] ?? ""}
                suffix="min"
                onChange={(value) => onTime(i, value)}
                onDec={() => onBump("times", i, -1)}
                onInc={() => onBump("times", i, 1)}
              />
            </div>
            <DiveReadout index={i} plan={plan} />
          </article>
        </div>
      ))}
    </div>
  );
}

function SitReadout({ sit }: { sit: PlanOutput["sits"][number] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs tracking-wide text-mist uppercase">Group after this interval</p>
        <p className="mt-1 font-mono text-3xl text-gold tabular-nums">{sit.group ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs tracking-wide text-mist uppercase">Minimum surface interval</p>
        <p className="mt-1 font-mono text-3xl text-teal tabular-nums">
          {sit.requiredMinutes == null ? "—" : formatClock(sit.requiredMinutes)}
        </p>
        {sit.requiredText && <p className="mt-1 text-sm text-mist">{sit.requiredText}</p>}
      </div>
    </div>
  );
}

function DiveReadout({ index, plan }: { index: number; plan: PlanOutput }) {
  const dive = plan.dives[index]!;
  if (!dive.ready) {
    return <p className="mt-4 text-sm text-mist">Enter a depth and a bottom time.</p>;
  }
  const letter = dive.exceeds ? "OVER" : (dive.group ?? "—");
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
      <div>
        <p className="text-xs tracking-wide text-mist uppercase">End group</p>
        <p
          className={
            "mt-1 grid h-16 w-16 place-items-center rounded-2xl font-mono text-3xl " +
            (dive.exceeds ? "bg-limit/15 text-limit" : "bg-gold/15 text-gold")
          }
        >
          {letter}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {index === 0 ? (
          <Stat label="MDT" value={dive.mdt == null ? "—" : `${dive.mdt} min`} />
        ) : (
          <Stat
            label="AMDT, do not exceed"
            value={dive.blocked ? "No dive" : dive.amdt == null ? "—" : `${dive.amdt} min`}
            danger
          />
        )}
        <Stat label="Table depth" value={dive.tableLabel ?? (dive.deep ? "Out" : "—")} />
        <Stat label="PO2" value={dive.po2 == null ? "—" : `${dive.po2.toFixed(2)} atm`} />
        <Stat label="CNS this dive" value={dive.cns == null ? "—" : `${dive.cns}%`} />
        {index > 0 && (
          <>
            <Stat label="RNT" value={dive.rnt == null ? "—" : `${dive.rnt} min`} />
            <Stat label="TNT" value={dive.tnt == null ? "—" : `${dive.tnt} min`} />
          </>
        )}
      </div>
      {dive.note && <p className="text-sm text-limit sm:col-span-2">{dive.note}</p>}
      {dive.exception && (
        <p className="text-sm text-mist sm:col-span-2">Table 3 exception depth. Confirm the printed card.</p>
      )}
    </div>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-mist uppercase">{label}</p>
      <p className={"mt-1 font-mono text-xl tabular-nums " + (danger ? "text-limit" : "text-ink")}>{value}</p>
    </div>
  );
}

function firstDiveFeet(draft: Draft): number {
  const raw = parseNum(draft.depths[0] ?? "");
  if (raw == null) return MIXES[draft.mix].depths[0]?.fsw ?? 0;
  if (draft.units === "FSW") return raw;
  const row = MIXES[draft.mix].depths.find((item) => item.msw === raw);
  return row ? row.fsw : Math.round(raw * 3.3);
}

function depthFeetOptions(draft: Draft): number[] {
  const feet = MIXES[draft.mix].depths.map((row) => row.fsw);
  const current = firstDiveFeet(draft);
  if (!feet.includes(current)) feet.push(current);
  return feet.sort((a, b) => a - b);
}

function GasTab({
  draft,
  plan,
  onPatch,
}: {
  draft: Draft;
  plan: PlanOutput;
  onPatch: (partial: Partial<Draft>) => void;
}) {
  return (
    <>
      <article className="rounded-card border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Tank and SAC</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium tracking-wide text-mist uppercase">SAC rate</span>
            <span className="mt-1 flex min-h-11 items-center rounded-2xl border border-line bg-water px-3">
              <input
                inputMode="decimal"
                value={draft.sac}
                onChange={(event) => onPatch({ sac: event.target.value })}
                className="w-full bg-transparent font-mono text-xl outline-none"
              />
              <span className="shrink-0 text-sm text-mist">cu ft/min</span>
            </span>
            <p className="mt-1 text-sm text-mist">Filled from the SAC CAL working average as you add dives.</p>
          </label>
          <label className="block">
            <span className="text-xs font-medium tracking-wide text-mist uppercase">Starting pressure</span>
            <span className="mt-1 flex min-h-11 items-center rounded-2xl border border-line bg-water px-3">
              <input
                inputMode="numeric"
                value={draft.startPsi}
                onChange={(event) => onPatch({ startPsi: event.target.value })}
                className="w-full bg-transparent font-mono text-xl outline-none"
              />
              <span className="text-sm text-mist">psi</span>
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium tracking-wide text-mist uppercase">Tank</span>
            <select
              value={draft.tank}
              onChange={(event) => onPatch({ tank: event.target.value })}
              className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-water px-3 text-base text-ink"
            >
              {TANKS.map((tank) => (
                <option key={tank.name} value={tank.name}>
                  {tank.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium tracking-wide text-mist uppercase">Depth in feet</span>
            <select
              value={firstDiveFeet(draft)}
              onChange={(event) => {
                const feet = Number(event.target.value);
                const row = MIXES[draft.mix].depths.find((item) => item.fsw === feet);
                const depths = [...draft.depths] as Draft["depths"];
                depths[0] = draft.units === "MSW" ? String(row?.msw ?? Math.round(feet / 3.3)) : String(feet);
                onPatch({ depths });
              }}
              className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-water px-3 text-base text-ink"
            >
              {depthFeetOptions(draft).map((feet) => (
                <option key={feet} value={feet}>
                  {feet} ft
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-mist">Same number as dive 1 maximum depth on Tables.</p>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Segment
            value={draft.twin ? "double" : "single"}
            options={[
              { id: "single", label: "Single" },
              { id: "double", label: "Double" },
            ]}
            onChange={(id) => onPatch({ twin: id === "double" })}
          />
          <Segment
            value={String(draft.divide)}
            options={[
              { id: "2", label: "Turn at half" },
              { id: "3", label: "Rule of thirds" },
            ]}
            onChange={(id) => onPatch({ divide: id === "3" ? 3 : 2 })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Segment
            value={draft.chain ? "same" : "fresh"}
            options={[
              { id: "fresh", label: "Fresh fill" },
              { id: "same", label: "Same tank" },
            ]}
            onChange={(id) => onPatch({ chain: id === "same" })}
          />
          <Segment
            value={String(draft.stopMin)}
            options={[
              { id: "0", label: "No stop" },
              { id: "3", label: "3 min stop" },
              { id: "5", label: "5 min stop" },
            ]}
            onChange={(id) => onPatch({ stopMin: Number(id) })}
          />
        </div>
        <p className="mt-3 text-sm text-mist">
          Tank factor {plan.factor ?? "—"} cu ft / 100 psi.
          {plan.sacPsi != null ? ` Perdix-style SAC ${plan.sacPsi} psi/min.` : ""} Dive 1 depth is shared with Tables. Dives 2 and 3 are set there.
        </p>
      </article>
      <div className="grid gap-3 lg:grid-cols-3">
        {plan.gas.map((dive, i) => (
          <article key={i} className="rounded-card border border-line bg-panel p-4">
            <h3 className="text-sm font-semibold text-mist uppercase">Dive {i + 1}</h3>
            {!dive.ready ? (
              <p className="mt-3 text-sm text-mist">No depth yet.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {i < 2 && (
                  <>
                    <GasLine label="Usable gas" value={dive.usablePsi == null ? "—" : `${dive.usablePsi} psi`} />
                    <GasLine label="Usable gas" value={dive.usableCuft == null ? "—" : `${dive.usableCuft} cu ft`} />
                    <GasLine label="Usable minutes" value={dive.usableMin == null ? "—" : `${dive.usableMin} min`} />
                  </>
                )}
                <GasLine label="Turn pressure" value={dive.turnPsi == null ? "—" : `${dive.turnPsi} psi`} />
                {i < 2 && (
                  <>
                    <GasLine label="Turn around" value={dive.beforePsi == null ? "—" : `${dive.beforePsi} psi`} />
                    <GasLine
                      label="Turn around"
                      value={
                        dive.beforePsi == null || plan.factor == null
                          ? "—"
                          : `${Math.round((dive.beforePsi / 100) * plan.factor)} cu ft`
                      }
                    />
                  </>
                )}
                <GasLine label="Minutes to turn" value={dive.beforeMin == null ? "—" : `${dive.beforeMin}`} />
                <GasLine label="Min gas" value={dive.minPsi == null ? "—" : `${dive.minPsi} psi`} />
                <GasLine label="PSI / min" value={dive.psiPerMin == null ? "—" : `${dive.psiPerMin}`} />
                <GasLine label="Status" value={dive.status ?? "—"} />
                <GasLine label="SPG if usable used" value={dive.remainPsi == null ? "—" : `${dive.remainPsi}`} />
              </dl>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function GasLine({ label, value }: { label: string; value: string }) {
  const tone =
    value === "OK"
      ? "text-teal"
      : value === "Past turn"
        ? "text-gold"
        : value === "Short on gas" || value === "No gas"
          ? "text-limit"
          : "text-ink";
  return (
    <div>
      <dt className="text-xs tracking-wide text-mist uppercase">{label}</dt>
      <dd className={"mt-1 font-mono text-lg tabular-nums " + tone}>{value}</dd>
    </div>
  );
}

function Profile({ points }: { points: [number, number][] }) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 72;
  const maxTime = points[points.length - 1]?.[0] || 1;
  const maxDepth = Math.max(...points.map((point) => point[1]), 1);
  const line = points
    .map((point, index) => {
      const x = (point[0] / maxTime) * width;
      const y = 4 + (point[1] / maxDepth) * (height - 8);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fill = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-20 w-full" aria-hidden="true">
      <path d={fill} fill="rgba(47,191,199,0.16)" />
      <path d={line} fill="none" stroke="#2fbfc7" strokeWidth="2" />
    </svg>
  );
}

function ComputerTab({
  draft,
  plan,
  gfLow,
  gfHigh,
  onPatch,
}: {
  draft: Draft;
  plan: PlanOutput;
  gfLow: number;
  gfHigh: number;
  onPatch: (partial: Partial<Draft>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logs, setLogs] = useState<LoggedDive[]>([SEED_DIVE]);
  const [picked, setPicked] = useState(SEED_DIVE.id);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHEARWATER_KEY);
      if (raw != null) {
        const parsed = JSON.parse(raw) as LoggedDive[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item) => item && typeof item.id === "string" && item.maxDepth);
          setLogs(valid);
          setPicked(valid[0]?.id ?? "");
        }
      }
    } catch {
      /* keep the seeded dive */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SHEARWATER_KEY, JSON.stringify(logs));
  }, [logs, ready]);

  const log = logs.find((item) => item.id === picked) ?? logs[0] ?? null;
  const slateCheck = useMemo(() => {
    if (!log) return null;
    const mix: MixId = log.fo2 >= 0.34 ? "ean36" : log.fo2 >= 0.3 ? "ean32" : "air";
    return computePlan({
      mix,
      units: log.imperial ? "FSW" : "MSW",
      depths: [Math.round(log.maxDepth), null, null],
      times: [Math.max(1, log.minutes), null, null],
      sits: [null, null],
      gas: {
        sac: parseNum(draft.sac) ?? 0,
        tank: draft.tank,
        twin: draft.twin,
        startPsi: parseNum(draft.startPsi) ?? 0,
        divide: draft.divide,
        chain: false,
        stopMin: 0,
      },
      gfHigh: log.gfHigh,
    }).computer[0];
  }, [log, draft.sac, draft.tank, draft.twin, draft.startPsi, draft.divide]);

  async function importCsv(file: File) {
    const dive = parseShearwaterCsv(await file.text());
    if (!dive) {
      setNote("That file is not a Shearwater Cloud CSV.");
      return;
    }
    setLogs((prev) => [dive, ...prev.filter((item) => item.id !== dive.id)].slice(0, 8));
    setPicked(dive.id);
    setNote(null);
  }

  function removeLog() {
    if (!log) return;
    const next = logs.filter((item) => item.id !== log.id);
    setLogs(next);
    setPicked(next[0]?.id ?? "");
    setNote(null);
  }

  const depthUnit = log?.imperial ? "ft" : "m";

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCsv(file);
          event.target.value = "";
        }}
      />
      {log ? (
        <article className="rounded-card border border-line bg-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Shearwater Cloud</h2>
              <p className="mt-1 text-lg font-semibold">
                {log.product} #{log.number}
              </p>
              <p className="text-sm text-mist">{formatDiveWhen(log.start)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="min-h-11 rounded-full border border-line px-3 text-sm text-mist"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={removeLog}
                className="min-h-11 rounded-full border border-line px-3 text-sm text-mist"
              >
                Remove
              </button>
            </div>
          </div>
          {logs.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {logs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPicked(item.id)}
                  className={
                    "min-h-11 rounded-full px-3 text-sm " +
                    (item.id === log.id ? "bg-teal text-teal-ink" : "bg-water text-mist")
                  }
                >
                  #{item.number}
                </button>
              ))}
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <GasLine label="Max depth" value={`${log.maxDepth} ${depthUnit}`} />
            <GasLine label="Dive time" value={`${log.minutes} min`} />
            <GasLine label="Average depth" value={`${log.avgDepth} ${depthUnit}`} />
            <GasLine label="GF on the dive" value={`${log.gfLow}/${log.gfHigh}`} />
            <GasLine label="Gas" value={gasName(log.fo2)} />
            <GasLine label="End CNS" value={`${log.cnsEnd}%`} />
            <GasLine label="Perdix NDL" value={log.ndl == null ? "—" : log.ndlCapped ? `${log.ndl}+` : `${log.ndl} min`} />
            <GasLine
              label={`Planner NDL at ${Math.round(log.maxDepth)} ${depthUnit}`}
              value={slateCheck?.ndlLabel == null ? "—" : `${slateCheck.ndlLabel} min`}
            />
            <GasLine
              label="Water"
              value={
                log.tempLow == null
                  ? "—"
                  : log.tempLow === log.tempHigh
                    ? `${log.tempLow}°`
                    : `${log.tempLow}–${log.tempHigh}°`
              }
            />
          </dl>
          <Profile points={log.profile} />
          {log.ndlCapped && (
            <p className="mt-2 text-sm text-mist">The Perdix shows 99+ while more than 99 minutes remain.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPatch({ gf: "custom", gfLow: String(log.gfLow), gfHigh: String(log.gfHigh) })}
              className="min-h-11 rounded-full bg-teal px-3 text-sm font-medium text-teal-ink"
            >
              Use GF {log.gfLow}/{log.gfHigh}
            </button>
            <p className="text-sm text-mist">
              {log.aiOff ? "Tank AI was off. " : ""}
              Serial {log.serial}. This file is a copy, not a live Cloud link.
            </p>
          </div>
          {note && <p className="mt-2 text-sm text-limit">{note}</p>}
        </article>
      ) : (
        <article className="rounded-card border border-line bg-panel p-4">
          <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Shearwater Cloud</h2>
          <p className="mt-2 text-sm text-mist">No dive file on this device.</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 min-h-11 rounded-full border border-line px-3 text-sm text-mist"
          >
            Import CSV
          </button>
          {note && <p className="mt-2 text-sm text-limit">{note}</p>}
        </article>
      )}
      <article className="rounded-card border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold tracking-wide text-mist uppercase">Conservatism</h2>
        <p className="mt-1 text-sm text-mist">Match the Conserv. line on the Perdix. GF high sets the no-stop time.</p>
        <div className="mt-3 grid gap-2 xl:grid-cols-2">
          {GF_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPatch({ gf: preset.id })}
              className={
                "min-h-11 rounded-2xl border px-3 text-left text-sm " +
                (draft.gf === preset.id ? "border-teal bg-teal/15 text-ink" : "border-line text-mist")
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
        {draft.gf === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-mist uppercase">GF low</span>
              <input
                inputMode="numeric"
                value={draft.gfLow}
                onChange={(event) => onPatch({ gfLow: event.target.value })}
                className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-water px-3 font-mono text-xl outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs text-mist uppercase">GF high</span>
              <input
                inputMode="numeric"
                value={draft.gfHigh}
                onChange={(event) => onPatch({ gfHigh: event.target.value })}
                className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-water px-3 font-mono text-xl outline-none"
              />
            </label>
          </div>
        )}
        {draft.gf === "custom" && gfLow > gfHigh && (
          <p className="mt-2 text-sm text-limit">GF low is above GF high. The Perdix will not take that pair.</p>
        )}
        <p className="mt-3 text-sm text-mist">
          MOD at PPO2 1.40 is {plan.mod} ft on {MIX_LABEL[draft.mix]}. This is not the computer. Ascent is 33 ft/min,
          sea level, square profile.
        </p>
      </article>
      <div className="grid gap-3 xl:grid-cols-3">
        {plan.computer.map((dive, i) => (
          <article key={i} className="rounded-card border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-mist uppercase">Dive {i + 1}</h3>
              <p className={dive.status === "In limits" ? "text-sm text-teal" : "text-sm text-limit"}>{dive.status ?? ""}</p>
            </div>
            {!dive.ready ? (
              <p className="mt-3 text-sm text-mist">Enter the dive, and the surface interval before a repetitive dive.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <GasLine label="Perdix NDL" value={dive.ndlLabel == null ? "—" : `${dive.ndlLabel} min`} />
                <GasLine label="NAUI limit" value={dive.naui == null ? "—" : `${dive.naui} min`} />
                <GasLine label="Plan no longer than" value={dive.planLabel == null ? "—" : `${dive.planLabel} min`} />
                <GasLine label="SurGF" value={dive.surGf == null ? "—" : `${dive.surGf}%`} />
                <GasLine label="Tissue" value={dive.tissue ?? "—"} />
                <GasLine label="GTR" value={dive.gtr == null ? "—" : `${dive.gtr} min`} />
                <GasLine label="PPO2" value={dive.ppo2 == null ? "—" : dive.ppo2.toFixed(2)} />
                <GasLine label="MOD" value={dive.mod == null ? "—" : `${dive.mod} ft`} />
              </dl>
            )}
            {dive.deeperThanMod && <p className="mt-3 text-sm text-limit">Deeper than the 1.40 MOD.</p>}
          </article>
        ))}
      </div>
    </>
  );
}

function Slate({ plan, gfLabel }: { plan: PlanOutput; gfLabel: string }) {
  return (
    <aside className="rounded-card border border-line bg-panel-2 p-4 lg:sticky lg:top-4 lg:self-start">
      <p className="text-xs font-medium tracking-widest text-mist uppercase">On the slate</p>
      <ol className="mt-3 flex flex-col gap-3">
        {plan.dives.map((dive, i) => (
          <li key={i} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
            <div>
              <p className="text-xs text-mist uppercase">Dive {i + 1}</p>
              <p className={"font-mono text-3xl " + (dive.exceeds ? "text-limit" : "text-gold")}>
                {dive.exceeds ? "OVER" : (dive.group ?? "—")}
              </p>
            </div>
            {i > 0 && (
              <div className="text-right">
                <p className="text-xs text-mist uppercase">Do not exceed</p>
                <p className="font-mono text-3xl text-limit tabular-nums">
                  {dive.blocked ? "No" : dive.amdt == null ? "—" : `${dive.amdt}`}
                  <span className="ml-1 text-base">min</span>
                </p>
              </div>
            )}
            {i === 0 && (
              <div className="text-right">
                <p className="text-xs text-mist uppercase">MDT</p>
                <p className="font-mono text-3xl tabular-nums">{dive.mdt ?? "—"}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-mist">
        Surface groups {plan.sits[0]?.group ?? "—"} then {plan.sits[1]?.group ?? "—"}.
        {plan.sessionCns != null ? ` Session CNS ${plan.sessionCns}%.` : ""} {gfLabel}.
      </p>
      <p className="mt-3 text-xs text-mist">
        iPhone or iPad: Share, then Add to Home Screen. Mac: open in Safari, then File, Add to Dock. Numbers stay on
        this device.
      </p>
    </aside>
  );
}
