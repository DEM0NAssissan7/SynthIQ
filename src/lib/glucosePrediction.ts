/**
 * Glucose prediction — m3 model with the original predictor as fallback.
 *
 * Two predictors live behind the same public interface (the signatures
 * used by PredictedGlucoseCard and metabolism.ts are unchanged):
 *
 *   1. m3 — `BG(t+H) ≈ BG(t) + slope60·H + GBR(features)`, where GBR is a
 *      histogram gradient-boosted tree (42 features, 2500 trees) trained
 *      on ~10 months of CGM + treatment data. It ships as a compact binary
 *      (`/models/predictor_60m.bin.gz`, ~2.2 MB gzipped), decoded once at
 *      runtime; the same file powers the Python backtester, and the
 *      exporter's self-test guarantees <0.01 mg/dL parity with sklearn.
 *      Three models are bundled: the point estimate plus 5th/95th
 *      quantiles, widened by the calibrated conformal band scale from the
 *      binary header. The model is trained at a 60-minute horizon; shorter
 *      horizons follow the damped current velocity and converge on the
 *      model's value (exact at H = 60 min), see horizonPrediction.
 *
 *   2. legacy — the original trend + Bateman-insulin-integral predictor
 *      (below, preserved verbatim from the pre-m3 codebase).
 *
 * `getPredictedGlucose` uses m3 once the binary has loaded and falls back
 * to legacy until then (or if loading fails, e.g. offline). `getRefReading`
 * and `getPredictedGlucoseAccuracy` are the original implementations; the
 * accuracy function calls `getPredictedGlucose`, so it scores whichever
 * predictor is currently active.
 *
 * The predictor is strictly read-only and emits no dosing advice.
 * All numeric parameters below are the named training parameters from
 * nightscout-analysis/m3.md — no fitted constants in this file.
 */

import type Glucose from "../models/events/glucose";
import type Insulin from "../models/events/insulin";
import type Meal from "../models/events/meal";
import type SugarReading from "../models/types/sugarReading";
import Unit from "../models/unit";
import { convertDimensions, MathUtil } from "./util";
import { estimateDynamicISF } from "./helpers/estimateDynamicISF";
import { getTimestampFromOffset } from "./timing";
import pako from "pako";

// ---------------------------------------------------------------------------
// Named parameters (m3.md / training config)
// ---------------------------------------------------------------------------

const M3 = {
  // training horizon
  horizonMinutes: 60,
  // velocity recursion (app_velocity)
  alpha: 0.85,
  beta: 0.35,
  phi: 0.8,
  periodMinutes: 5,
  // Bateman absorption
  ka: 0.5, // 1/h
  ke: 0.7, // 1/h
  // carb appearance
  carbKa: 1.0, // 1/h
  carbKb: 2.0, // 1/h
  // data hygiene
  sglFloor: 40, // mg/dL, sensor sentinels below this are dropped
  sglCeiling: 400, // mg/dL, sensor sentinels above this are dropped
  minSpacingMs: 180_000, // collapse sub-3-min CGM rows (import artifacts)
  continuityGapMaxMinutes: 180, // anchor eligibility gate
  // feature windows
  nReadings: 36, // 3 h of ~5-min CGM
  bolusLookbackHours: 6,
  rescueLookbackHours: 3,
  mealLookbackHours: 3,
  rescueActiveWindowMinutes: 35,
  lowFlag: 70, // mg/dL
  highFlag: 180, // mg/dL
  // defaults when no event is on file
  defaultTSinceBolus: 400, // min
  defaultTToPeak: 240, // min
  defaultTSinceRescue: 180, // min
  defaultTSinceMeal: 240, // min
  defaultBasal: 9.0, // U/day
  defaultTSinceBasal: 24.0, // h
  // per-column upper clips (min only, applied exactly as at training time)
  clipGapMin: 180,
  clipTSinceBolus: 360,
  clipTToPeak: 180,
  clipTSinceRescue: 180,
  clipTSinceMeal: 240,
  clipTSinceBasal: 24,
} as const;

// Feature column order (must match the Python feature builder in m3.py).
const F = {
  bgLast: 0,
  bgMean35: 1,
  bgStd35: 2,
  slope15: 3,
  slope30: 4,
  slope60: 5,
  slope120: 6,
  curvature: 7,
  min30: 8,
  max30: 9,
  posInRange: 10,
  low60: 11,
  high60: 12,
  appVelocity: 13,
  dircode: 14,
  gapMin: 15,
  iob: 16,
  absNext60: 17,
  abs60_120: 18,
  nBolus: 19,
  tSinceBolus: 20,
  unitsLast: 21,
  tToPeak: 22,
  g60: 23,
  g120: 24,
  g180: 25,
  gLast: 26,
  tSinceRescue: 27,
  nRescue: 28,
  cabNext60: 29,
  cab60_120: 30,
  rescueActive: 31,
  mc60: 32,
  mc120: 33,
  mc180: 34,
  mp180: 35,
  tSinceMeal: 36,
  basalU: 37,
  tSinceBasal: 38,
  hourSin: 39,
  hourCos: 40,
  weekday: 41,
} as const;

const N_FEATURES = 42;

// ---------------------------------------------------------------------------
// Model binary
// ---------------------------------------------------------------------------

/** Binary model header (40 bytes) — also the honest stats block. */
export interface M3ModelInfo {
  nFeatures: number;
  nModels: number;
  bandScale: number; // calibrated conformal multiplier c
  holdoutMae: number; // last-30d holdout, mg/dL
  holdoutMedian: number; // last-30d holdout, mg/dL
  holdoutCoverage: number; // 0..1
  holdoutBandWidth: number; // mean band width, mg/dL
  trainedThroughEpochDay: number; // train end date, days since 1970-01-01
}

interface M3TreeModel {
  nTrees: number;
  valueScale: number;
  baseline: number;
  treeStart: Uint32Array; // node index where each tree begins
  treeLen: Uint32Array; // node count per tree
  thr: Float64Array; // per-node threshold (0 for leaves)
  feat: Uint16Array; // per-node feature index (0xFFFF for leaves)
  left: Int16Array; // per-node left child (-1 for leaves)
  right: Int16Array; // per-node right child (-1 for leaves)
  val: Int16Array; // per-node quantized leaf value
}

interface M3Bundle {
  info: M3ModelInfo;
  res: M3TreeModel;
  q05: M3TreeModel;
  q95: M3TreeModel;
}

const MODEL_URL = "/models/predictor_60m.bin.gz";

let bundle: M3Bundle | null = null;
let loadPromise: Promise<M3ModelInfo> | null = null;

function parseModelBlock(
  dv: DataView,
  off: number,
): { model: M3TreeModel; off: number } {
  const nTrees = dv.getUint32(off, true);
  const valueScale = dv.getUint32(off + 4, true);
  const baseline = dv.getFloat64(off + 8, true);
  let p = off + 24; // skip learning_rate (f32, informational) + pad (f32)

  const treeStart: number[] = [];
  const treeLen: number[] = [];
  const thr: number[] = [];
  const feat: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const val: number[] = [];

  for (let t = 0; t < nTrees; t++) {
    const len = dv.getUint16(p, true);
    p += 2;
    treeStart.push(thr.length);
    treeLen.push(len);
    for (let k = 0; k < len; k++) {
      thr.push(dv.getFloat64(p, true));
      const f = dv.getUint16(p + 8, true);
      // leaves are marked 0xFFFF; internal nodes must index a real feature
      if (f !== 0xffff && f >= N_FEATURES) {
        throw new Error(`m3 binary: bad feature index ${f}`);
      }
      feat.push(f);
      left.push(dv.getInt16(p + 10, true));
      right.push(dv.getInt16(p + 12, true));
      val.push(dv.getInt16(p + 14, true));
      p += 16;
    }
  }

  return {
    off: p,
    model: {
      nTrees,
      valueScale,
      baseline,
      treeStart: Uint32Array.from(treeStart),
      treeLen: Uint32Array.from(treeLen),
      thr: Float64Array.from(thr),
      feat: Uint16Array.from(feat),
      left: Int16Array.from(left),
      right: Int16Array.from(right),
      val: Int16Array.from(val),
    },
  };
}

function parseM3(bytes: Uint8Array): M3Bundle {
  // magic is "M3P1" — M, digit 3, P, digit 1 (0x33, not 0x53!)
  if (
    bytes.length < 40 ||
    bytes[0] !== 0x4d ||
    bytes[1] !== 0x33 ||
    bytes[2] !== 0x50 ||
    bytes[3] !== 0x31
  ) {
    throw new Error("m3 binary: bad magic");
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(4, true) !== 1) {
    throw new Error("m3 binary: unsupported version");
  }
  const nFeatures = dv.getUint32(8, true);
  if (nFeatures !== N_FEATURES) {
    throw new Error(
      `m3 binary: expected ${N_FEATURES} features, got ${nFeatures}`,
    );
  }
  const nModels = dv.getUint32(12, true);
  if (nModels < 3) {
    throw new Error(`m3 binary: expected 3 models, got ${nModels}`);
  }
  const info: M3ModelInfo = {
    nFeatures,
    nModels,
    bandScale: dv.getFloat32(16, true),
    holdoutMae: dv.getFloat32(20, true),
    holdoutMedian: dv.getFloat32(24, true),
    holdoutCoverage: dv.getFloat32(28, true),
    holdoutBandWidth: dv.getFloat32(32, true),
    trainedThroughEpochDay: dv.getUint32(36, true),
  };
  const b0 = parseModelBlock(dv, 40);
  const b1 = parseModelBlock(dv, b0.off);
  const b2 = parseModelBlock(dv, b1.off);
  return { info, res: b0.model, q05: b1.model, q95: b2.model };
}

function looksGzipped(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
}

async function fetchModelBytes(
  source: string | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (source instanceof ArrayBuffer) {
    const bytes = new Uint8Array(source);
    const out = looksGzipped(bytes) ? pako.inflate(bytes) : bytes;
    return out;
  }
  if (source instanceof Uint8Array) {
    const out = looksGzipped(source) ? pako.inflate(source) : source;
    return out;
  }
  const resp = await fetch(source);
  if (!resp.ok) {
    throw new Error(`m3 model fetch failed: HTTP ${resp.status}`);
  }
  const raw = new Uint8Array(await resp.arrayBuffer());
  // the asset is gzipped, but the browser has already decompressed it if the
  // server sent Content-Encoding: gzip (Vite does for .gz files)
  return looksGzipped(raw) ? pako.inflate(raw) : raw;
}

/**
 * Load (and parse) the prediction model. Accepts a URL, a gzip-compressed or
 * raw ArrayBuffer/Uint8Array (gzip magic is auto-detected). Resolves with
 * the model's honest stats. Repeated calls reuse the in-flight or completed
 * load.
 */
export function loadGlucosePredictionModel(
  source?: string | ArrayBuffer | Uint8Array,
): Promise<M3ModelInfo> {
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async () => {
    const bytes = await fetchModelBytes(
      source ?? (isWebOrigin() ? MODEL_URL : ""),
    );
    bundle = parseM3(bytes);
    featureCache = null;
    return bundle.info;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

/** True once the m3 model has been loaded and predictions use it. */
export function hasLoadedModel(): boolean {
  return bundle !== null;
}

/** The model's self-describing stats (band scale, holdout MAE, …), if loaded. */
export function getModelInfo(): M3ModelInfo | null {
  return bundle ? bundle.info : null;
}

function isWebOrigin(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof location !== "undefined" &&
    (location.protocol === "http:" || location.protocol === "https:")
  );
}

/**
 * Walk one tree model over a feature row. Mirrors the exporter's binary
 * inference exactly: NaN goes left (sklearn missing_go_to_left), internal
 * nodes take the left branch when x[feature] <= threshold, leaf values are
 * pre-shrunk (the stored learning rate is informational only), and child
 * indices are tree-local (rebased by adding the tree's flat start).
 */
function predictOne(m: M3TreeModel, x: Float64Array): number {
  let total = m.baseline;
  for (let t = 0; t < m.nTrees; t++) {
    const base = m.treeStart[t];
    let n = base;
    for (;;) {
      const f = m.feat[n];
      if (f === 0xffff) {
        total += m.val[n] / m.valueScale;
        break;
      }
      const xv = x[f];
      const child = Number.isNaN(xv) || xv <= m.thr[n] ? m.left[n] : m.right[n];
      if (child < 0) {
        throw new Error(`m3 binary: corrupt node in tree ${t}`);
      }
      n = base + child;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Feature construction (mirrors scripts/m3.py row_features exactly)
// ---------------------------------------------------------------------------

interface CleanSeries {
  t: number[]; // ms, ascending
  s: number[]; // mg/dL
}

/**
 * Clean raw readings the same way the training loader does: drop sensor
 * sentinels, dedupe by timestamp (last wins), collapse rows closer than
 * MIN_SPACING_MS (keep the newest value at the cluster head).
 */
function cleanReadings(readings: SugarReading[]): CleanSeries {
  const byT = new Map<number, number>();
  for (const r of readings) {
    if (r.sugar < M3.sglFloor || r.sugar > M3.sglCeiling) continue;
    byT.set(r.timestamp.getTime(), r.sugar);
  }
  const ts = [...byT.keys()].sort((a, b) => a - b);
  const t: number[] = [];
  const s: number[] = [];
  for (const time of ts) {
    const sugar = byT.get(time) as number;
    if (t.length > 0 && time - t[t.length - 1] < M3.minSpacingMs) {
      s[s.length - 1] = sugar;
    } else {
      t.push(time);
      s.push(sugar);
    }
  }
  return { t, s };
}

/** Bateman cumulative absorbed fraction, hours since injection. */
function batemanF(tHours: number, a: number, b: number): number {
  if (tHours <= 0) return 0;
  const A = (a * b) / (b - a);
  return (
    A * ((1 - Math.exp(-a * tHours)) / a - (1 - Math.exp(-b * tHours)) / b)
  );
}

function fInsulin(tHours: number): number {
  return batemanF(tHours, M3.ka, M3.ke);
}

function fCarb(tHours: number): number {
  return batemanF(tHours, M3.carbKa, M3.carbKb);
}

/** Least-squares slope (mg/dL per min) of (x in min, y) pairs. */
function leastSquaresSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let k = 0; k < n; k++) {
    sx += xs[k];
    sy += ys[k];
    sxx += xs[k] * xs[k];
    sxy += xs[k] * ys[k];
  }
  const d = n * sxx - sx * sx;
  return d !== 0 ? (n * sxy - sx * sy) / d : 0;
}

/**
 * Slope (mg/dL per min) over the last `minutes` of history ending at index
 * i; 0 when fewer than 4 points fall in the window.
 */
function slopeH(t: number[], s: number[], i: number, minutes: number): number {
  const lo = t[i] - minutes * 60_000;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let j = i; j >= 0 && t[j] >= lo; j--) {
    xs.push((t[j] - t[i]) / 60_000);
    ys.push(s[j]);
  }
  if (xs.length < 4) return 0;
  return leastSquaresSlope(xs, ys);
}

/**
 * App-model velocity estimator — exact port of
 * bg_prediction_backtest.app_velocity(sugars, times_ms, ALPHA, BETA, PHI).
 * Walks consecutive CGM pairs chronologically: the first valid pair seeds
 * the velocity, each later pair is projected forward by the closed-form
 * phi-integral of the prior smoothed background, then the pair velocity is
 * re-weighted by (beta, phi) over the elapsed 5-minute periods. Returns
 * mg/dL per minute (0 when no valid pair exists).
 */
function appVelocity(s: number[], t: number[]): number {
  let v: number | null = null;
  for (let i = 0; i + 1 < s.length; i++) {
    const dt = (t[i + 1] - t[i]) / 60_000;
    if (dt <= 0) continue;
    if (v === null) {
      v = (s[i + 1] - s[i]) / dt;
      continue;
    }
    const periods = dt / M3.periodMinutes;
    const a = 1 - Math.pow(1 - M3.alpha, periods);
    const b = 1 - Math.pow(1 - M3.beta, periods);
    const integ: number =
      ((v * M3.periodMinutes) / (1 - M3.phi)) * (1 - Math.pow(M3.phi, periods));
    const smoothed: number = s[i + 1] * a + (s[i] + integ) * (1 - a);
    v = ((smoothed - s[i]) / dt) * b + v * Math.pow(M3.phi, periods) * (1 - b);
  }
  return v ?? 0;
}

const T_PEAK_BAT_MIN = (Math.log(M3.ka / M3.ke) / (M3.ka - M3.ke)) * 60; // Bateman peak time, min

function populationStd(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((acc, x) => acc + x, 0) / data.length;
  const sq = data.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
  return Math.sqrt(sq / data.length);
}

function asc<T extends { timestamp: Date }>(events: T[]): T[] {
  return events
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Build the 42-dim feature row at the most recent reading, exactly as in
 * m3.py (windows, defaults, and per-column clips included). Returns null
 * when the anchor is not eligible (too few points, or a CGM gap longer
 * than the continuity gate).
 */
function buildFeatureRow(
  cr: CleanSeries,
  insulins: Insulin[],
  rescues: Glucose[],
  meals: Meal[] | undefined,
  basals: Insulin[] | undefined,
): Float64Array | null {
  const n = cr.t.length;
  if (n < 2) return null;
  const i = n - 1;
  if (
    cr.t[i] - cr.t[Math.max(0, i - (M3.nReadings - 1))] >
    M3.continuityGapMaxMinutes * 60_000
  ) {
    return null;
  }

  const t_i = cr.t[i];
  const a = cr.s[i];
  const w0 = Math.max(0, i - (M3.nReadings - 1));
  const ys35 = cr.s.slice(w0, i + 1);

  const row = new Float64Array(N_FEATURES);
  row[F.bgLast] = a;
  row[F.bgMean35] = ys35.reduce((acc, x) => acc + x, 0) / ys35.length;
  row[F.bgStd35] = populationStd(ys35);

  const s15 = slopeH(cr.t, cr.s, i, 15) * 60;
  const s30 = slopeH(cr.t, cr.s, i, 30) * 60;
  const s60 = slopeH(cr.t, cr.s, i, 60) * 60;
  const s120 = slopeH(cr.t, cr.s, i, 120) * 60;
  row[F.slope15] = s15;
  row[F.slope30] = s30;
  row[F.slope60] = s60;
  row[F.slope120] = s120;
  row[F.curvature] = s15 - s30;

  const lo30 = t_i - 30 * 60_000;
  let min30 = Infinity;
  let max30 = -Infinity;
  for (let j = i; j >= 0 && cr.t[j] >= lo30; j--) {
    min30 = Math.min(min30, cr.s[j]);
    max30 = Math.max(max30, cr.s[j]);
  }
  const rng = max30 - min30;
  row[F.min30] = min30;
  row[F.max30] = max30;
  row[F.posInRange] = rng > 1 ? (a - min30) / rng : 0.5;

  const lo60 = t_i - 60 * 60_000;
  let min60 = Infinity;
  let max60 = -Infinity;
  for (let j = i; j >= 0 && cr.t[j] >= lo60; j--) {
    min60 = Math.min(min60, cr.s[j]);
    max60 = Math.max(max60, cr.s[j]);
  }
  row[F.low60] = min60 < M3.lowFlag ? 1 : 0;
  row[F.high60] = max60 > M3.highFlag ? 1 : 0;

  row[F.appVelocity] =
    appVelocity(cr.s.slice(w0, i + 1), cr.t.slice(w0, i + 1)) * 60;
  row[F.dircode] = 0; // the app's SugarReading has no CGM trend arrow
  row[F.gapMin] = i > 0 ? (t_i - cr.t[i - 1]) / 60_000 : 0;

  // bolus features (last 6 h)
  const ins = asc(
    insulins.filter((u) => {
      const t = u.timestamp.getTime();
      return t <= t_i && t > t_i - M3.bolusLookbackHours * 3_600_000;
    }),
  );
  let iob = 0;
  let abs60 = 0;
  let abs120 = 0;
  let unitsLast = 0;
  let tToPeak: number = M3.defaultTToPeak;
  let tSinceB: number = M3.defaultTSinceBolus;
  for (const u of ins) {
    const th = (t_i - u.timestamp.getTime()) / 3_600_000;
    iob += u.value * (1 - fInsulin(th));
    abs60 += u.value * (fInsulin(th + 1) - fInsulin(th));
    abs120 += u.value * (fInsulin(th + 2) - fInsulin(th + 1));
    unitsLast = u.value;
    tToPeak = u.timestamp.getTime() / 60_000 + T_PEAK_BAT_MIN - t_i / 60_000;
    tSinceB = Math.min(tSinceB, th * 60);
  }
  row[F.iob] = iob;
  row[F.absNext60] = abs60;
  row[F.abs60_120] = abs120;
  row[F.nBolus] = ins.length;
  row[F.tSinceBolus] = tSinceB;
  row[F.unitsLast] = unitsLast;
  row[F.tToPeak] = tToPeak;

  // rescue features (last 3 h, in grams)
  const res = asc(
    rescues.filter((r) => {
      const t = r.timestamp.getTime();
      return t <= t_i && t > t_i - M3.rescueLookbackHours * 3_600_000;
    }),
  );
  let g60 = 0;
  let g120 = 0;
  let g180 = 0;
  let gLast = 0;
  let cab60 = 0;
  let cab120 = 0;
  let tSinceR: number = M3.defaultTSinceRescue;
  let rescueActive = 0;
  for (const r of res) {
    const t = r.timestamp.getTime();
    const g = r.carbs;
    const th = (t_i - t) / 3_600_000;
    if (t > t_i - 3_600_000) g60 += g;
    if (t > t_i - 2 * 3_600_000) g120 += g;
    g180 += g;
    gLast = g;
    cab60 += g * (fCarb(th + 1) - fCarb(th));
    cab120 += g * (fCarb(th + 2) - fCarb(th + 1));
    tSinceR = Math.min(tSinceR, th * 60);
    if (t_i - t < M3.rescueActiveWindowMinutes * 60_000) rescueActive = 1;
  }
  row[F.g60] = g60;
  row[F.g120] = g120;
  row[F.g180] = g180;
  row[F.gLast] = gLast;
  row[F.tSinceRescue] = tSinceR;
  row[F.nRescue] = res.length;
  row[F.cabNext60] = cab60;
  row[F.cab60_120] = cab120;
  row[F.rescueActive] = rescueActive;

  // meal features (last 3 h)
  const ml = meals
    ? asc(
        meals.filter((m) => {
          const t = m.timestamp.getTime();
          return t <= t_i && t > t_i - M3.mealLookbackHours * 3_600_000;
        }),
      )
    : [];
  let mc60 = 0;
  let mc120 = 0;
  let mc180 = 0;
  let mp180 = 0;
  let tSinceM: number = M3.defaultTSinceMeal;
  for (const m of ml) {
    const t = m.timestamp.getTime();
    if (t > t_i - 3_600_000) mc60 += m.carbs;
    if (t > t_i - 2 * 3_600_000) mc120 += m.carbs;
    mc180 += m.carbs;
    mp180 += m.protein;
    tSinceM = Math.min(tSinceM, (t_i - t) / 60_000);
  }
  row[F.mc60] = mc60;
  row[F.mc120] = mc120;
  row[F.mc180] = mc180;
  row[F.mp180] = mp180;
  row[F.tSinceMeal] = tSinceM;

  // basal features: most recent basal dose at or before the anchor.
  // `value` on a basal event is U/day in this app's data model — do not
  // convert to a rate.
  let basalU: number = M3.defaultBasal;
  let tSinceBasal: number = M3.defaultTSinceBasal;
  if (basals && basals.length > 0) {
    let newest: Insulin | null = null;
    for (const b of basals) {
      const t = b.timestamp.getTime();
      if (t <= t_i && (newest === null || t > newest.timestamp.getTime())) {
        newest = b;
      }
    }
    if (newest !== null) {
      basalU = newest.value;
      tSinceBasal = (t_i - newest.timestamp.getTime()) / 3_600_000;
    }
  }
  row[F.basalU] = basalU;
  row[F.tSinceBasal] = tSinceBasal;

  // time of day (UTC, matching training)
  const dt = new Date(t_i);
  const hour = dt.getUTCHours() + dt.getUTCMinutes() / 60;
  row[F.hourSin] = Math.sin((2 * Math.PI * hour) / 24);
  row[F.hourCos] = Math.cos((2 * Math.PI * hour) / 24);
  row[F.weekday] = (dt.getUTCDay() + 6) % 7; // Monday = 0

  // per-column upper clips (min only), exactly as at training time
  row[F.gapMin] = Math.min(row[F.gapMin], M3.clipGapMin);
  row[F.tSinceBolus] = Math.min(row[F.tSinceBolus], M3.clipTSinceBolus);
  row[F.tToPeak] = Math.min(row[F.tToPeak], M3.clipTToPeak);
  row[F.tSinceRescue] = Math.min(row[F.tSinceRescue], M3.clipTSinceRescue);
  row[F.tSinceMeal] = Math.min(row[F.tSinceMeal], M3.clipTSinceMeal);
  row[F.tSinceBasal] = Math.min(row[F.tSinceBasal], M3.clipTSinceBasal);

  return row;
}

// ---------------------------------------------------------------------------
// Cached model evaluation (one tree pass per input state, not per target)
// ---------------------------------------------------------------------------

interface M3Evaluation {
  anchorTs: number; // most recent reading, ms
  bg: number; // anchor BG, mg/dL
  slope60: number; // mg/dL per min over the last hour
  velocity: number; // smoothed current rate (app velocity), mg/dL per min
  res: number; // residual at the 60-min horizon, mg/dL
  q05: number;
  q95: number;
}

let featureCache: { key: string; result: M3Evaluation } | null = null;

function lastTs(events: { timestamp: Date }[] | undefined): string {
  if (!events || events.length === 0) return "0";
  const mid = events.length >> 1;
  return `${events[mid].timestamp.getTime()}-${events[events.length - 1].timestamp.getTime()}`;
}

function featureKey(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  meals: Meal[] | undefined,
  basals: Insulin[] | undefined,
): string {
  return [
    readings.length,
    lastTs(readings),
    insulins.length,
    lastTs(insulins),
    rescues.length,
    lastTs(rescues),
    meals ? meals.length : 0,
    lastTs(meals),
    basals ? basals.length : 0,
    lastTs(basals),
  ].join("|");
}

/**
 * Run all three tree models on the current feature row. Cached per input
 * state so a render tick that asks for many target times pays for the
 * 7500-tree walk only once.
 */
function m3Evaluation(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  meals: Meal[] | undefined,
  basals: Insulin[] | undefined,
): M3Evaluation | null {
  if (!bundle) return null;
  const key = featureKey(readings, insulins, rescues, meals, basals);
  if (featureCache && featureCache.key === key) {
    return featureCache.result;
  }
  const cr = cleanReadings(readings);
  const row = buildFeatureRow(cr, insulins, rescues, meals, basals);
  if (!row) return null;
  const result: M3Evaluation = {
    anchorTs: cr.t[cr.t.length - 1],
    bg: row[F.bgLast],
    slope60: row[F.slope60] / 60,
    velocity: row[F.appVelocity] / 60,
    res: predictOne(bundle.res, row),
    q05: predictOne(bundle.q05, row),
    q95: predictOne(bundle.q95, row),
  };
  featureCache = { key, result };
  return result;
}

/** Change in BG after `horizonMin` if `velocity` decays by phi each period. */
function dampedTrend(velocity: number, horizonMin: number): number {
  return getIntegratedDelta(
    velocity * M3.periodMinutes,
    horizonMin / M3.periodMinutes,
    M3.phi,
  );
}

/**
 * Horizon extension. Only the 60-minute model exists, so the path to it
 * follows the damped velocity (the legacy predictor's trend form), plus a
 * correction growing linearly in the horizon that lands on the model's own
 * trend term at horizonMinutes. At horizonMinutes the expression is the
 * trained model itself.
 */
function horizonPrediction(
  e: M3Evaluation,
  horizonMin: number,
): { pred: number; lo: number; hi: number } {
  const scale = horizonMin / M3.horizonMinutes;
  const correction =
    e.slope60 * M3.horizonMinutes - dampedTrend(e.velocity, M3.horizonMinutes);
  const trend = dampedTrend(e.velocity, horizonMin) + correction * scale;
  return {
    pred: e.bg + trend + e.res * scale,
    lo: e.bg + trend + e.q05 * scale,
    hi: e.bg + trend + e.q95 * scale,
  };
}
// ---------------------------------------------------------------------------
// Legacy predictor — the original pre-m3 algorithm, preserved verbatim.
// Active until the m3 binary has loaded (and as the fallback if loading
// fails).
// ---------------------------------------------------------------------------

const ALPHA = 0.85; // CGM Smoothing factor (1 is no smoothing)
const BETA = 0.35; // Velocity change damping factor (1 means velocity changes instantly)
const PHI = 0.8; // Moving velocity decay constant (1 means no velocity decay)
const PERIOD = 5;

function getIntegratedDelta(
  velocityPerPeriod: number,
  periods: number,
  phi: number,
): number {
  if (periods <= 0) return 0;
  // Closed-form integral: v0 * (phi / (1 - phi)) * (1 - phi^periods)
  return (velocityPerPeriod / (1.0 - phi)) * (1.0 - Math.pow(phi, periods));
}

export function getRefReading(readings: SugarReading[]): SugarReading | null {
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (sortedReadings.length === 0) return null;
  return sortedReadings[sortedReadings.length - 1];
}

function legacyPredictGlucose(
  readings: SugarReading[],
  timestamp: Date,
  insulins: Insulin[],
  rescues: Glucose[],
): number | null {
  if (readings.length < 2) return null;
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  /**
   * The model works with a moving average
   */
  // First we look into the past to get our weighted avg velocity
  let velocity: number | null = null;
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const reading = sortedReadings[i];
    const nextReading = sortedReadings[i + 1];
    const dt =
      (nextReading.timestamp.getTime() - reading.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Minute);
    if (dt <= 0) continue;
    if (velocity === null) {
      velocity = (nextReading.sugar - reading.sugar) / dt;
      continue;
    }

    // Coefficient scaling
    const periods = dt / PERIOD;
    const alpha = 1 - Math.pow(1 - ALPHA, periods);
    const beta = 1 - Math.pow(1 - BETA, periods);

    const modelPredictedBG =
      reading.sugar + getIntegratedDelta(velocity * PERIOD, periods, PHI);
    const smoothedBG: number =
      nextReading.sugar * alpha + modelPredictedBG * (1 - alpha);

    const deltaBG = smoothedBG - reading.sugar;
    const decayedPriorVelocity: number = velocity * Math.pow(PHI, periods);
    velocity = (deltaBG / dt) * beta + decayedPriorVelocity * (1 - beta);
  }
  if (velocity === null || !Number.isFinite(velocity)) return null;

  // Predict future BG anchored to the latest actual reading
  const finalReading = getRefReading(readings);
  if (!finalReading) return null;
  const finalTimestamp = finalReading.timestamp;
  const deltaTime =
    (timestamp.getTime() - finalTimestamp.getTime()) *
    convertDimensions(Unit.Time.Millis, Unit.Time.Minute);

  if (deltaTime <= 0) {
    return finalReading.sugar;
  }

  const predictedDelta = getIntegratedDelta(
    velocity * PERIOD,
    deltaTime / PERIOD,
    PHI,
  );
  const predicted = finalReading.sugar + predictedDelta;
  if (!Number.isFinite(predicted)) return finalReading.sugar;

  // Now (if applicable) we look at the dynamicISF and the readings
  if (insulins && rescues) {
    const dynamicISF = estimateDynamicISF(readings, insulins, rescues);
    // If we have no (valid) Dynamic ISF, we use the normal predicted
    if (dynamicISF <= 0) return predicted;
    // Extrapolate insulin absorption into the future
    const predictedUnitsAbsorbed = insulins.reduce(
      (n, i) => n + i.batemanIntegral(finalTimestamp, timestamp),
      0,
    );
    const insulinPredictedDelta = -predictedUnitsAbsorbed * dynamicISF;
    const insulinPredicted = finalReading.sugar + insulinPredictedDelta;
    if (!Number.isFinite(insulinPredicted)) return predicted;
    // Apply the dynamic ISF
    // If both are dropping, choose the min
    if (insulinPredictedDelta <= 0 && predictedDelta <= 0)
      return Math.min(predicted, insulinPredicted);
    // TODO: Make this more reliable. We know that the predictedDelta is certainly influenced by insulin's effect (from dynamicISF).
    // This needs a proper solution to account for both accurately. AI DOES NOT TOUCH THIS CODE.
    if (predictedDelta > 0)
      return finalReading.sugar + (predictedDelta + insulinPredictedDelta);
  }
  return predicted;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Predict glucose at `timestamp` (a future or past Date).
 *
 * Uses the m3 model once it has loaded; until then (or if loading fails)
 * the original algorithm above runs, so behavior never silently changes
 * between app starts. `meals` and `basals` are optional extras consumed
 * only by the m3 features.
 */
export function getPredictedGlucose(
  readings: SugarReading[],
  timestamp: Date,
  insulins: Insulin[],
  rescues: Glucose[],
  meals?: Meal[],
  basals?: Insulin[],
): number | null {
  if (!bundle) console.log("No bundle loaded");
  if (bundle) {
    const evaluation = m3Evaluation(readings, insulins, rescues, meals, basals);
    if (evaluation) {
      const horizonMin = (timestamp.getTime() - evaluation.anchorTs) / 60_000;
      if (horizonMin <= 0) {
        return evaluation.bg;
      }
      return horizonPrediction(evaluation, horizonMin).pred;
    }
  }
  return legacyPredictGlucose(readings, timestamp, insulins, rescues);
}

// Prediction accuracy querying
export function getPredictedGlucoseAccuracy(
  _readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  timeframe: number, // How far to look back (hours)
) {
  if (_readings.length <= 0) return null;
  const sortedReadings = _readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const lastReading = sortedReadings[sortedReadings.length - 1];
  const cutoff = getTimestampFromOffset(lastReading.timestamp, -timeframe);
  const readings = _readings.filter(
    (r) => r.timestamp.getTime() >= cutoff.getTime(),
  );
  if (readings.length < 2) return null;
  const deviations: number[] = [];
  let correctPredictionsCount = 0;
  let totalPredictions = 0;
  for (let i = 1; i < readings.length - 1; i++) {
    const truncatedReadings = readings.slice(0, i);
    const nextReading = readings[i];
    if (!nextReading) continue;
    const predicted = getPredictedGlucose(
      truncatedReadings,
      nextReading.timestamp,
      insulins,
      rescues,
    );
    if (!predicted) continue;
    const actual = nextReading.sugar;
    const deviation = predicted - actual;
    deviations.push(Math.abs(deviation));
    totalPredictions++;
    if (Math.round(deviation) === 0) correctPredictionsCount++;
  }
  const immediateMeanDeviation = MathUtil.mean(deviations);
  const immediatePercentWithinVariance =
    deviations.length !== 0
      ? (100 *
          deviations.reduce(
            (n, d) => (Math.abs(d) - immediateMeanDeviation <= 0 ? n + 1 : n),
            0,
          )) /
        deviations.length
      : 0;
  const immediatePercentPerfect =
    totalPredictions !== 0
      ? (correctPredictionsCount / totalPredictions) * 100
      : 0;

  // Now calculate the 30-minute and 60-minute deviations
  const getDeviations = (minutesAhead: number) => {
    const deviations: number[] = [];
    for (let i = 1; i < readings.length; i++) {
      const truncatedReadings = readings.slice(0, i);
      // Where we are
      const baseReading = readings[i - 1];
      if (!baseReading) continue;
      const targetFuture = getTimestampFromOffset(
        baseReading.timestamp,
        minutesAhead / 60,
      );
      // Find the reading we have available that is closest to the future timestamp without being behind it
      const targetReading = (() => {
        for (let j = i; j < readings.length; j++) {
          const reading = readings[j];
          if (reading.timestamp.getTime() < targetFuture.getTime()) continue;
          return reading;
        }
        return null;
      })();
      if (!targetReading) return deviations;
      const prediction = getPredictedGlucose(
        truncatedReadings,
        targetReading.timestamp,
        insulins,
        rescues,
      );
      if (!prediction) continue;
      const actual = targetReading.sugar;
      const deviation = prediction - actual;
      deviations.push(Math.abs(deviation));
    }
    return deviations;
  };

  const deviations30min = getDeviations(30);
  const meanDeviation30min = MathUtil.mean(deviations30min);
  const deviations60min = getDeviations(60);
  const meanDeviation60min = MathUtil.mean(deviations60min);

  return {
    meanAvgDeviation: immediateMeanDeviation,
    percentCorrect: immediatePercentPerfect,
    percentWithinVariance: immediatePercentWithinVariance,
    meanDeviation30min: meanDeviation30min,
    meanDeviation60min: meanDeviation60min,
  };
}
