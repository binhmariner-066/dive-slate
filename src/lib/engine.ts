// @ts-nocheck
import { MIXES } from "./naui-data.ts";

export type MixId = "air" | "ean32" | "ean36";
export type Units = "FSW" | "MSW";
export type GfPreset = "low" | "med" | "high" | "tec" | "custom";

export type GasInput = {
  sac: number;
  tank: string;
  twin: boolean;
  startPsi: number;
  divide: 2 | 3;
  chain: boolean;
  stopMin: number;
};

export type GasDive = {
  ready: boolean;
  depthFt: number | null;
  minCuft: number | null;
  minPsi: number | null;
  ata: number | null;
  cuftPerMin: number | null;
  psiPer5: number | null;
  psiPerMin: number | null;
  available: number | null;
  usablePsi: number | null;
  usableCuft: number | null;
  usableMin: number | null;
  turnPsi: number | null;
  beforePsi: number | null;
  beforeMin: number | null;
  status: string | null;
  afterBottom: number | null;
  stopPsi: number | null;
  afterStop: number | null;
  steppedMin: number | null;
  remainPsi: number | null;
};

export type DiveResult = {
  ready: boolean;
  deep: boolean;
  tableFsw: number | null;
  tableLabel: string | null;
  mdt: number | null;
  group: string | null;
  exceeds: boolean;
  po2: number | null;
  cns: number | null;
  rnt: number | null;
  amdt: number | null;
  tnt: number | null;
  blocked: boolean;
  exception: boolean;
  note: string | null;
};

export type SitResult = {
  minutes: number | null;
  group: string | null;
  requiredMinutes: number | null;
  requiredGroup: string | null;
  requiredText: string | null;
};

export type ComputerDive = {
  ready: boolean;
  ndl: number | null;
  ndlLabel: string | null;
  tissue: string | null;
  surGf: number | null;
  naui: number | null;
  plan: number | null;
  planLabel: string | null;
  status: string | null;
  ppo2: number | null;
  mod: number | null;
  deeperThanMod: boolean;
  gtr: number | null;
};

export type PlanOutput = {
  dives: DiveResult[];
  sits: SitResult[];
  gas: GasDive[];
  computer: ComputerDive[];
  sessionCns: number | null;
  factor: number | null;
  sacPsi: number | null;
  mod: number;
};

export type SheetGasInput = {
  sac: number;
  depth: number | null;
  tank: string;
  twin: boolean;
  available: number;
  divide: 2 | 3;
};

export type SheetGas = {
  ready: boolean;
  factor: number | null;
  minCuft: number | null;
  minPsi: number | null;
  clamped: boolean;
  ata: number | null;
  cuftPerMin: number | null;
  cuftPer5: number | null;
  psiPer5: number | null;
  psiPerMin: number | null;
  usablePsi: number | null;
  usableCuft: number | null;
  usableMin: number | null;
  turnPsi: number | null;
  beforePsi: number | null;
  beforeCuft: number | null;
  beforeMin: number | null;
  steppedMin: number | null;
  usedRemain: number | null;
  remainPsi: number | null;
};

/** Air-management spreadsheet, sections 1–7. One dive. Independent of the tables. */
export function sheetGas(input: SheetGasInput): SheetGas {
  const factor = tankFactor(input.tank, input.twin);
  const blank: SheetGas = {
    ready: false,
    factor,
    minCuft: null,
    minPsi: null,
    clamped: false,
    ata: null,
    cuftPerMin: null,
    cuftPer5: null,
    psiPer5: null,
    psiPerMin: null,
    usablePsi: null,
    usableCuft: null,
    usableMin: null,
    turnPsi: null,
    beforePsi: null,
    beforeCuft: null,
    beforeMin: null,
    steppedMin: null,
    usedRemain: null,
    remainPsi: null,
  };
  const depth = input.depth;
  if (depth == null || depth <= 0 || factor == null || factor <= 0 || !(input.sac > 0)) return blank;
  const halfAta = depth / 2 / 33 + 1;
  const minCuft = xround(input.sac * 2 * halfAta * (depth / 10 + 1), 0);
  const rawPsi = (minCuft / factor) * 100;
  const clamped = rawPsi <= 499;
  const minPsi = xround(clamped ? 500 : rawPsi, 0);
  const ata = xround(depth / 33 + 1, 1);
  const cuftPerMin = xround(input.sac * ata, 1);
  const cuftPer5 = cuftPerMin * 5;
  const psiPer5 = floor0((cuftPer5 / factor) * 100);
  const psiPerMin = floor0((cuftPerMin / factor) * 100);
  const usablePsi = input.available - minPsi;
  const usableCuft = xround((usablePsi / 100) * factor, 0);
  const usableMin = psiPerMin === 0 ? null : floor0(usablePsi / psiPerMin);
  const turnPsi = xround(input.available - usablePsi / (input.divide === 2 ? 2 : 3), 0);
  const beforePsi = input.available - turnPsi;
  const beforeCuft = xround((beforePsi / 100) * factor, 0);
  const beforeMin = psiPerMin === 0 ? null : floor0(beforePsi / psiPerMin);
  const steppedMin = psiPerMin === 0 ? null : Math.floor(usablePsi / psiPerMin / 5) * 5;
  const usedRemain = steppedMin == null ? null : usablePsi - (steppedMin / 5) * psiPer5;
  const remainPsi = usedRemain == null ? null : usedRemain + minPsi;
  return {
    ready: true,
    factor,
    minCuft,
    minPsi,
    clamped,
    ata,
    cuftPerMin,
    cuftPer5,
    psiPer5,
    psiPerMin,
    usablePsi,
    usableCuft,
    usableMin,
    turnPsi,
    beforePsi,
    beforeCuft,
    beforeMin,
    steppedMin,
    usedRemain,
    remainPsi,
  };
}

export const LETTERS = "ABCDEFGHIJKLMNO".split("");
export const MIX_LABEL = {
	air: "Air",
	ean32: "EAN 32",
	ean36: "EAN 36"
};
export const TANKS = [
	{
		name: "AL 40",
		single: 1.25
	},
	{
		name: "AL 80",
		single: 2.5
	},
	{
		name: "LP 80",
		single: 3
	},
	{
		name: "LP 83",
		single: 3.5
	},
	{
		name: "LP 95",
		single: 4
	},
	{
		name: "LP 104",
		single: 4.3
	},
	{
		name: "LP 120",
		single: 4.5
	},
	{
		name: "HP 80",
		single: 2.3
	},
	{
		name: "HP 100",
		single: 3
	},
	{
		name: "HP 120",
		single: 3.5
	},
	{
		name: "HP 130",
		single: 4
	}
];
var CNS = [
	[.5, 720],
	[.6, 720],
	[.7, 570],
	[.8, 450],
	[.9, 360],
	[1, 300],
	[1.1, 240],
	[1.2, 210],
	[1.25, 195],
	[1.3, 180],
	[1.35, 165],
	[1.4, 150],
	[1.45, 135],
	[1.5, 120],
	[1.55, 83],
	[1.6, 45]
];
var COMPARTMENTS = [
	{
		ht: 5,
		a: 1.1696,
		b: .5578
	},
	{
		ht: 8,
		a: 1,
		b: .6514
	},
	{
		ht: 12.5,
		a: .8618,
		b: .7222
	},
	{
		ht: 18.5,
		a: .7562,
		b: .7825
	},
	{
		ht: 27,
		a: .62,
		b: .8126
	},
	{
		ht: 38.3,
		a: .5043,
		b: .8434
	},
	{
		ht: 54.3,
		a: .441,
		b: .8693
	},
	{
		ht: 77,
		a: .4,
		b: .891
	},
	{
		ht: 109,
		a: .375,
		b: .9092
	},
	{
		ht: 146,
		a: .35,
		b: .9222
	},
	{
		ht: 187,
		a: .3295,
		b: .9319
	},
	{
		ht: 239,
		a: .3065,
		b: .9403
	},
	{
		ht: 305,
		a: .2835,
		b: .9477
	},
	{
		ht: 390,
		a: .261,
		b: .9544
	},
	{
		ht: 498,
		a: .248,
		b: .9602
	},
	{
		ht: 635,
		a: .2327,
		b: .9653
	}
];
var PAMB = 1.01325;
var WV = .0627;
var FT_PER_BAR = 33;
export function xround(n, digits = 0) {
	const p = 10 ** digits;
	const x = n * p;
	return (x >= 0 ? Math.floor(x + .5) : Math.ceil(x - .5)) / p;
}
function floor0(n) {
	return n >= 0 ? Math.floor(n) : Math.ceil(n);
}
export function formatClock(mins) {
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	if (h <= 0) return `${m} min`;
	return `${h} hr ${String(m).padStart(2, "0")} min`;
}
function tableFsw(mix, depth, units) {
	const table = MIXES[mix];
	if (units === "FSW") {
		if (mix === "ean36" && depth > 110) return "DEEP";
		if (depth > 130) return "DEEP";
		if (depth <= 20) return 20;
		for (const row of table.depths) if (row.fsw === depth) return depth;
		for (const row of table.depths) if (row.fsw >= depth) return row.fsw;
		return "DEEP";
	}
	if (mix === "ean36" && depth > 33) return "DEEP";
	if (depth > 40) return "DEEP";
	if (depth <= 6) return 20;
	for (const row of table.depths) if (row.msw === depth) return row.fsw;
	for (const row of table.depths) if (row.msw >= depth) return row.fsw;
	return "DEEP";
}
function depthIndex(mix, fsw) {
	return MIXES[mix].depths.findIndex((row) => row.fsw === fsw);
}
function letterFor(times, tnt) {
	const seq = times.map((t) => t == null ? 99999 : t);
	if (tnt <= seq[0]) return "A";
	let idx = 0;
	for (let i = 0; i < seq.length; i++) if (seq[i] <= tnt) idx = i;
	else break;
	const exact = seq[idx] === tnt;
	return LETTERS[Math.min(14, idx + (exact ? 0 : 1))];
}
function groupAfter(mix, from, sit) {
	if (sit >= 1440) return "—";
	if (sit < 10) return "<10";
	const fi = LETTERS.indexOf(from);
	if (fi < 0) return "?";
	const table = MIXES[mix];
	for (let ni = 0; ni < LETTERS.length; ni++) {
		const mn = table.minSit[ni][fi];
		const mx = table.maxSit[ni][fi];
		if (mn == null || mx == null) continue;
		if (sit >= mn && sit <= mx) return LETTERS[ni];
	}
	return "?";
}
function po2At(mix, fsw) {
	const row = MIXES[mix].depths[depthIndex(mix, fsw)];
	if (mix === "air") return xround(.21 * (fsw / 33 + 1), 2);
	return row.po2 ?? xround(MIXES[mix].fo2 * (fsw / 33 + 1), 2);
}
function cnsPercent(po2, minutes) {
	const p = Math.max(po2, .5);
	let limit = CNS[0][1];
	for (const [key, mins] of CNS) if (key <= p + 1e-9) limit = mins;
	else break;
	return xround(100 * minutes / limit, 0);
}
function emptyDive() {
	return {
		ready: false,
		deep: false,
		tableFsw: null,
		tableLabel: null,
		mdt: null,
		group: null,
		exceeds: false,
		po2: null,
		cns: null,
		rnt: null,
		amdt: null,
		tnt: null,
		blocked: false,
		exception: false,
		note: null
	};
}
function labelFor(mix, fsw, units) {
	const row = MIXES[mix].depths[depthIndex(mix, fsw)];
	return units === "MSW" ? `${row.msw} msw` : `${row.fsw} fsw`;
}
function firstDive(mix, depth, time, units) {
	const fsw = tableFsw(mix, depth, units);
	if (fsw === "DEEP") return {
		...emptyDive(),
		ready: true,
		deep: true,
		note: mix === "ean36" ? "EAN 36 tables stop at 110 fsw / 33 msw." : "Deeper than 130 fsw / 40 msw."
	};
	const di = depthIndex(mix, fsw);
	const row = MIXES[mix].depths[di];
	const po2 = po2At(mix, fsw);
	const exceeds = row.mdt != null && time > row.mdt && !row.star;
	const group = exceeds ? "EXCEEDS" : letterFor(MIXES[mix].t1[di], time);
	return {
		...emptyDive(),
		ready: true,
		tableFsw: fsw,
		tableLabel: labelFor(mix, fsw, units),
		mdt: row.mdt,
		group,
		exceeds,
		po2,
		cns: cnsPercent(po2, time),
		rnt: 0,
		tnt: time,
		exception: fsw <= MIXES[mix].exception,
		note: exceeds ? "Bottom time is past the no-stop limit." : null
	};
}
function nextDive(mix, prevGroup, depth, time, units) {
	const fsw = tableFsw(mix, depth, units);
	if (fsw === "DEEP") return {
		...emptyDive(),
		ready: true,
		deep: true,
		note: mix === "ean36" ? "EAN 36 tables stop at 110 fsw / 33 msw." : "Deeper than 130 fsw / 40 msw."
	};
	const di = depthIndex(mix, fsw);
	const row = MIXES[mix].depths[di];
	const base = {
		...emptyDive(),
		ready: true,
		tableFsw: fsw,
		tableLabel: labelFor(mix, fsw, units),
		mdt: row.mdt,
		po2: po2At(mix, fsw),
		cns: cnsPercent(po2At(mix, fsw), time),
		exception: fsw <= MIXES[mix].exception
	};
	if (!prevGroup || prevGroup === "EXCEEDS") return {
		...base,
		note: "Fix the previous dive before this one can be scheduled."
	};
	if (prevGroup === "<10") return {
		...base,
		note: "Surface interval under 10 min — add the two bottom times and treat them as one dive."
	};
	if (prevGroup === "?") return {
		...base,
		note: "That surface interval does not land in a Table 2 window."
	};
	let rnt;
	let amdt;
	if (prevGroup === "—") {
		rnt = 0;
		amdt = row.mdt;
	} else {
		const gi = LETTERS.indexOf(prevGroup);
		rnt = gi < 0 ? null : MIXES[mix].rnt[gi][di] ?? null;
		amdt = gi < 0 ? null : MIXES[mix].amdt[gi][di] ?? null;
	}
	if (rnt == null || amdt == null) return {
		...base,
		note: "No Table 3 cell for this group and depth."
	};
	if (amdt < 0 || rnt < 0) return {
		...base,
		rnt: rnt < 0 ? null : rnt,
		blocked: true,
		exceeds: true,
		note: "This letter group cannot make a no-stop dive at that depth."
	};
	const tnt = rnt + time;
	const exceeds = row.mdt != null && tnt > row.mdt && !row.star;
	const group = exceeds ? "EXCEEDS" : letterFor(MIXES[mix].t1[di], tnt);
	return {
		...base,
		rnt,
		amdt,
		tnt,
		group,
		exceeds,
		note: exceeds ? "Total nitrogen time is past the no-stop limit." : null
	};
}
function requiredSit(mix, current, depth, time, units) {
	if (!current || current === "EXCEEDS" || current === "<10" || current === "?") return {
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: null
	};
	if (current === "—") return {
		requiredMinutes: 10,
		requiredGroup: "A",
		requiredText: "Residual nitrogen is cleared. 10 minutes is the table minimum."
	};
	if (depth == null || time == null || time <= 0) return {
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: null
	};
	const fsw = tableFsw(mix, depth, units);
	if (fsw === "DEEP") return {
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: "Next depth is outside the tables."
	};
	const di = depthIndex(mix, fsw);
	const mdt = MIXES[mix].depths[di].mdt;
	if (mdt != null && time > mdt) return {
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: "Even group A cannot give enough no-stop time."
	};
	let best = -1;
	for (let i = 0; i < LETTERS.length; i++) {
		const v = MIXES[mix].amdt[i][di];
		if (v != null && v >= time) best = i;
	}
	if (best < 0) return {
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: "Even group A cannot give enough no-stop time."
	};
	const ci = LETTERS.indexOf(current);
	const target = LETTERS[best];
	if (ci <= best) return {
		requiredMinutes: 10,
		requiredGroup: target,
		requiredText: "Already in a group that allows this dive. 10 min minimum."
	};
	const mins = MIXES[mix].minSit[best][ci];
	if (mins == null) return {
		requiredMinutes: null,
		requiredGroup: target,
		requiredText: "No surface-interval window reaches that group."
	};
	return {
		requiredMinutes: mins,
		requiredGroup: target,
		requiredText: `Shortest interval to reach group ${target}.`
	};
}
function sitResult(mix, fromGroup, minutes, nextDepth, nextTime, units) {
	const req = requiredSit(mix, fromGroup, nextDepth, nextTime, units);
	if (!fromGroup || fromGroup === "EXCEEDS" || minutes == null) return {
		minutes,
		group: null,
		...req
	};
	return {
		minutes,
		group: groupAfter(mix, fromGroup, minutes),
		...req
	};
}
export function planGas(gas, depths, times) {
	const factor = tankFactor(gas.tank, gas.twin);
	const dives = [];
	let carry = gas.startPsi;
	for (let i = 0; i < 3; i++) {
		const available = i === 0 || !gas.chain ? gas.startPsi : carry;
		const dive = gasOne(depths[i] ?? null, times[i] ?? null, gas, factor, available);
		dives.push(dive);
		if (gas.chain) carry = dive.afterStop == null ? gas.startPsi : Math.max(0, dive.afterStop);
	}
	return {
		dives,
		factor,
		sacPsi: factor && factor > 0 ? xround(gas.sac * 100 / factor, 1) : null
	};
}
function tankFactor(tank, twin) {
	const row = TANKS.find((t) => t.name === tank);
	if (!row) return null;
	return twin ? row.single * 2 : row.single;
}
function gasOne(depthFt, bottom, gas, factor, available) {
	const blank = {
		ready: false,
		depthFt,
		minCuft: null,
		minPsi: null,
		ata: null,
		cuftPerMin: null,
		psiPer5: null,
		psiPerMin: null,
		available,
		usablePsi: null,
		usableCuft: null,
		usableMin: null,
		turnPsi: null,
		beforePsi: null,
		beforeMin: null,
		status: null,
		afterBottom: null,
		stopPsi: null,
		afterStop: null,
		steppedMin: null,
		remainPsi: null
	};
	if (depthFt == null || factor == null || factor <= 0 || !(gas.sac > 0)) return blank;
	const minCuft = xround(gas.sac * 2 * (depthFt / 2 / 33 + 1) * (depthFt / 10 + 1), 0);
	const rawPsi = minCuft / factor * 100;
	const minPsi = xround(rawPsi <= 499 ? 500 : rawPsi, 0);
	const ata = xround(depthFt / 33 + 1, 1);
	const cuftPerMin = xround(gas.sac * ata, 1);
	const psiPer5 = floor0(cuftPerMin * 5 * 100 / factor);
	const psiPerMin = floor0(cuftPerMin * 100 / factor);
	const start = available ?? gas.startPsi;
	const usablePsi = start - minPsi;
	const usableCuft = xround(usablePsi / 100 * factor, 0);
	const usableMin = psiPerMin <= 0 ? null : usablePsi <= 0 ? 0 : floor0(usablePsi / psiPerMin);
	const turnPsi = usablePsi <= 0 ? null : xround(start - usablePsi / (gas.divide === 2 ? 2 : 3), 0);
	const beforePsi = turnPsi == null ? null : start - turnPsi;
	const beforeMin = beforePsi == null || psiPerMin <= 0 ? null : beforePsi <= 0 ? 0 : floor0(beforePsi / psiPerMin);
	let status = "—";
	if (psiPerMin > 0) {
		if (usablePsi <= 0) status = "No gas";
		else if (bottom == null) status = "—";
		else if (usableMin != null && bottom > usableMin) status = "Short on gas";
		else if (beforeMin != null && bottom / 2 > beforeMin) status = "Past turn";
		else status = "OK";
	}
	const used = bottom != null && psiPerMin > 0 ? bottom * psiPerMin : null;
	const afterBottom = used == null ? null : start - used;
	const stopAta = xround(Math.min(15, depthFt) / 33 + 1, 1);
	const stopRate = floor0(xround(gas.sac * stopAta, 1) * 100 / factor);
	const stopPsi = gas.stopMin * stopRate;
	const afterStop = afterBottom == null ? null : afterBottom - stopPsi;
	const steppedMin = usablePsi <= 0 || psiPerMin <= 0 ? null : Math.floor(usablePsi / psiPerMin / 5) * 5;
	const remainPsi = steppedMin == null ? null : usablePsi - steppedMin / 5 * psiPer5 + minPsi;
	return {
		ready: true,
		depthFt,
		minCuft,
		minPsi,
		ata,
		cuftPerMin,
		psiPer5,
		psiPerMin,
		available: start,
		usablePsi,
		usableCuft,
		usableMin,
		turnPsi,
		beforePsi,
		beforeMin,
		status,
		afterBottom,
		stopPsi,
		afterStop,
		steppedMin,
		remainPsi
	};
}
export const GF_PRESETS: { id: GfPreset; label: string; low: number; high: number }[] = [
	{
		id: "low",
		label: "Rec Low 45/95",
		low: 45,
		high: 95
	},
	{
		id: "med",
		label: "Rec Medium 40/85",
		low: 40,
		high: 85
	},
	{
		id: "high",
		label: "Rec High 35/75",
		low: 35,
		high: 75
	},
	{
		id: "tec",
		label: "Tec 30/70",
		low: 30,
		high: 70
	},
	{
		id: "custom",
		label: "Custom",
		low: 30,
		high: 70
	}
];
function ndlMinutes(depthFt, gfHigh, fo2, p0) {
	const fn2 = 1 - fo2;
	const psurfGas = .95055 * fn2;
	const palvb = (PAMB + depthFt / FT_PER_BAR - WV) * fn2;
	const tasc = depthFt / 33;
	const rate = (psurfGas - palvb) / tasc;
	let best = Infinity;
	let tissue = 1;
	COMPARTMENTS.forEach((c, i) => {
		const k = Math.LN2 / c.ht;
		const ek = Math.exp(-k * tasc);
		const ptol = PAMB + gfHigh / 100 * (c.a + PAMB / c.b - PAMB);
		const inf = palvb + rate * (tasc - 1 / k) - (palvb - rate / k) * ek + ek * palvb;
		const pIn = p0[i];
		const ps0 = inf + ek * (pIn - palvb);
		let t;
		if (ps0 >= ptol) t = 0;
		else if (inf <= ptol) t = 9999;
		else {
			const numer = (ptol - inf) / (ek * (pIn - palvb));
			t = numer <= 0 ? 0 : -Math.log(numer) / k;
		}
		if (t < best) {
			best = t;
			tissue = i + 1;
		}
	});
	return {
		minutes: best,
		tissue
	};
}
function tissuesAfter(depthFt, bottom, sit, fo2, p0) {
	const fn2 = 1 - fo2;
	const psurfAir = .95055 * .79;
	const psurfGas = .95055 * fn2;
	const palvb = (PAMB + depthFt / FT_PER_BAR - WV) * fn2;
	const tasc = depthFt / 33;
	const rate = (psurfGas - palvb) / tasc;
	return COMPARTMENTS.map((c, i) => {
		const k = Math.LN2 / c.ht;
		const pb = palvb + (p0[i] - palvb) * Math.exp(-k * bottom);
		const ek = Math.exp(-k * tasc);
		let pa = palvb + rate * (tasc - 1 / k) - (palvb - pb - rate / k) * ek;
		if (sit != null) pa = psurfAir + (pa - psurfAir) * Math.exp(-k * sit);
		return pa;
	});
}
function surGf(depthFt, bottom, fo2, p0) {
	const fn2 = 1 - fo2;
	const psurfGas = .95055 * fn2;
	const palvb = (PAMB + depthFt / FT_PER_BAR - WV) * fn2;
	const tasc = depthFt / 33;
	const rate = (psurfGas - palvb) / tasc;
	let max = -Infinity;
	COMPARTMENTS.forEach((c, i) => {
		const k = Math.LN2 / c.ht;
		const pb = palvb + (p0[i] - palvb) * Math.exp(-k * bottom);
		const ek = Math.exp(-k * tasc);
		const gf = (palvb + rate * (tasc - 1 / k) - (palvb - pb - rate / k) * ek - PAMB) / (c.a + PAMB / c.b - PAMB) * 100;
		if (gf > max) max = gf;
	});
	return max;
}
function computerOne(depthFt, bottom, fo2, gfHigh, p0, naui, gasDive, sacPsi, linked) {
	const mod = xround(33 * (1.4 / fo2 - 1), 0);
	const blank = {
		ready: false,
		ndl: null,
		ndlLabel: null,
		tissue: null,
		surGf: null,
		naui,
		plan: null,
		planLabel: null,
		status: null,
		ppo2: depthFt == null ? null : xround(fo2 * (1 + depthFt / 33), 2),
		mod,
		deeperThanMod: depthFt != null && depthFt > mod,
		gtr: null
	};
	if (depthFt == null || depthFt <= 0 || !linked) return blank;
	const solved = ndlMinutes(depthFt, gfHigh, fo2, p0);
	const ndl = solved.minutes >= 9990 ? 9999 : floor0(solved.minutes);
	const ndlLabel = solved.minutes >= 9990 ? "240+" : String(ndl);
	const ppo2 = xround(fo2 * (1 + depthFt / 33), 2);
	const plan = ndlLabel === "240+" ? naui : naui == null ? ndl : Math.min(ndl, naui);
	const planLabel = plan == null ? ndlLabel : String(plan);
	let status = null;
	if (bottom != null) {
		const overNdl = ndlLabel !== "240+" && bottom > ndl;
		const overNaui = naui != null && bottom > naui;
		if (overNdl && (naui == null || overNaui)) status = "Over both";
		else if (overNdl) status = "Needs stops";
		else if (overNaui) status = "Past table";
		else status = "In limits";
	}
	let gtr = null;
	if (sacPsi != null && sacPsi > 0 && gasDive.available != null && gasDive.minPsi != null) {
		const amb = PAMB + depthFt / FT_PER_BAR;
		const tasc = depthFt / 33;
		const bottomRate = sacPsi * (amb / PAMB);
		const ascentPsi = sacPsi * ((amb / PAMB + 1) / 2 * tasc);
		if (bottomRate > 0) gtr = Math.max(0, floor0((gasDive.available - gasDive.minPsi - ascentPsi) / bottomRate));
	}
	const gf = bottom == null ? null : xround(surGf(depthFt, bottom, fo2, p0), 0);
	return {
		ready: true,
		ndl,
		ndlLabel,
		tissue: `${COMPARTMENTS[solved.tissue - 1].ht} min`,
		surGf: gf,
		naui,
		plan,
		planLabel,
		status,
		ppo2,
		mod,
		deeperThanMod: depthFt > mod,
		gtr
	};
}
function depthFeet(depth, units) {
	if (depth == null || depth <= 0) return null;
	return units === "MSW" ? xround(depth * 3.3, 1) : depth;
}
export function computePlan(input) {
	const { mix, units } = input;
	const dives = [
		emptyDive(),
		emptyDive(),
		emptyDive()
	];
	const d0 = input.depths[0] ?? null;
	const t0 = input.times[0] ?? null;
	if (d0 != null && d0 > 0 && t0 != null && t0 > 0) dives[0] = firstDive(mix, d0, t0, units);
	const sits = [sitResult(mix, dives[0].group, input.sits[0] ?? null, input.depths[1] ?? null, input.times[1] ?? null, units), {
		minutes: null,
		group: null,
		requiredMinutes: null,
		requiredGroup: null,
		requiredText: null
	}];
	const d1 = input.depths[1] ?? null;
	const t1 = input.times[1] ?? null;
	if (d1 != null && d1 > 0 && t1 != null && t1 > 0) dives[1] = nextDive(mix, sits[0].group, d1, t1, units);
	sits[1] = sitResult(mix, dives[1].group, input.sits[1] ?? null, input.depths[2] ?? null, input.times[2] ?? null, units);
	const d2 = input.depths[2] ?? null;
	const t2 = input.times[2] ?? null;
	if (d2 != null && d2 > 0 && t2 != null && t2 > 0) dives[2] = nextDive(mix, sits[1].group, d2, t2, units);
	const feet = [
		0,
		1,
		2
	].map((i) => depthFeet(input.depths[i] ?? null, units));
	const gasPlan = planGas(input.gas, feet, [
		input.times[0] ?? null,
		input.times[1] ?? null,
		input.times[2] ?? null
	]);
	const { factor, sacPsi } = gasPlan;
	const gas = gasPlan.dives;
	const fo2 = MIXES[mix].fo2;
	const psurf = .95055 * .79;
	let tissues = COMPARTMENTS.map(() => psurf);
	let linked = true;
	const computer = [];
	for (let i = 0; i < 3; i++) {
		const ft = feet[i] ?? null;
		const bottom = input.times[i] ?? null;
		const naui = i === 0 ? dives[0].mdt : dives[i].amdt;
		computer.push(computerOne(ft, bottom, fo2, input.gfHigh, tissues, naui, gas[i], sacPsi, linked));
		if (ft != null && bottom != null && bottom > 0 && linked) {
			if (i < 2 && input.sits[i] == null) linked = false;
			else tissues = tissuesAfter(ft, bottom, i < 2 ? input.sits[i] ?? null : null, fo2, tissues);
		} else if (i < 2 && (ft == null || bottom == null)) linked = false;
	}
	const cnsVals = dives.map((d) => d.cns).filter((n) => n != null);
	return {
		dives,
		sits,
		gas,
		computer,
		sessionCns: cnsVals.length ? cnsVals.reduce((a, b) => a + b, 0) : null,
		factor,
		sacPsi,
		mod: xround(33 * (1.4 / fo2 - 1), 0)
	};
}
