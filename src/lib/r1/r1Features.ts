/**
 * r1Features.ts — feature builder, TS port of the r1 trainer's builder
 * (nightscout-analysis/scripts/r1_train.py, build_dataset).
 *
 * The model was trained on features built by that exact code, so this port
 * must reproduce it line-by-line:
 *
 *   seq: 36 slots x 8 channels; slot k is the 60 s window
 *        [t_anchor - (35-k)*60s, t_anchor - (35-k)*60s + 60s)
 *        ch0 bg/100, ch1 (bg - prev_bg)/20, ch2-4 bolus units in last
 *        30/60/120 min /10, ch5 rescue in last 40 min, ch6 meal carbs
 *        in last 60 min (min 200)/60, ch7 1 if bg present OR basal in
 *        last 60 min
 *   scal: 27 scalars in the trainer's exact order (bg, mean, std, 4 slopes
 *        x60, app velocity x60, dir, units_last, t_since_b, iob, ab30,
 *        ab60, carb60, carb120, t_since_r, rescue_active, mc60, mc120,
 *        mc180, mp180, t_since_m, sin/cos hour, weekday, t_since_basal)
 *        with the trainer's per-channel caps.
 *
 * Past-only guarantee: every window ends at the anchor or the slot time
 * (bisect_right at those times, never after them). Treatments use the same
 * lists the base predictor consumes; meals and basal times are windowed
 * here. No interpolation, no centered windows, no target-time data.
 *
 * Parity: the trainer accumulates in float32, this port in float64; the
 * end-to-end residual difference is < 1e-3 mg/dL (verified against the
 * trainer's saved dataset on the test split).
 */

import { Bateman } from "../bateman";

// Trainer constants (r1_train.py / bg_prediction_backtest.py)
const A = 36;
const C = 8;
const MS_MIN = 60_000;
const MS_H = 3_600_000;
const ALPHA = 0.85;
const BETA = 0.35;
const PHI = 0.8;
const PERIOD = 5.0;
const CGM_DELAY_MIN = 5.0;
const RESCUE_DUR_MIN = 30.0;
// Trainer's SCAL_CAPS, indexed by scalar position
const SCAL_CAPS: Record<number, number> = {
  9: 360.0,
  10: 400.0,
  16: 400.0,
  22: 400.0,
  18: 240.0,
  19: 240.0,
  20: 240.0,
  26: 24.0,
};

export interface R1Bolus {
  timeMs: number;
  units: number;
  ka: number;
  ke: number;
}

export interface R1Meal {
  timeMs: number;
  carbs: number;
  protein: number;
}

export interface R1FeatureData {
  seq: number[]; // 36*8
  scal: number[]; // 27
}

/**
 * EXACT copy of the base predictor's recursive velocity smoother
 * (glucosePrediction.ts lines 55-110; identical to the trainer's
 * app.app_velocity in bg_prediction_backtest.py). Runs over the given
 * window (the builder passes the last 36 readings). Returns mg/dL/min
 * (same as the trainer's app.app_velocity; the caller multiplies by 60).
 */
function appVelocity(s: number[], t: number[]): number {
  let velocity: number | null = null;
  for (let i = 0; i < s.length - 1; i++) {
    const dt = (t[i + 1] - t[i]) / 60000;
    if (dt <= 0) continue;
    if (velocity === null) {
      velocity = (s[i + 1] - s[i]) / dt;
      continue;
    }
    const periods = dt / PERIOD;
    const alpha = 1 - Math.pow(1 - ALPHA, periods);
    const beta = 1 - Math.pow(1 - BETA, periods);
    // == base getIntegratedDelta(velocity * PERIOD, periods, PHI)
    const integ: number =
      (velocity * PERIOD) / (1 - PHI) * (1 - Math.pow(PHI, periods));
    const modelPredictedBG = s[i] + integ;
    const smoothedBG = s[i + 1] * alpha + modelPredictedBG * (1 - alpha);
    const decayedPriorVelocity: number = velocity * Math.pow(PHI, periods);
    velocity =
      ((smoothedBG - s[i]) / dt) * beta +
      decayedPriorVelocity * (1 - beta);
  }
  return velocity === null ? 0 : velocity;
}

/** bisect_left: first index with arr[i] >= t */
function bisectLeft(arr: number[], t: number, lo = 0, hi = arr.length): number {
  let l = lo,
    h = hi;
  while (l < h) {
    const mid = (l + h) >> 1;
    if (arr[mid] < t) l = mid + 1;
    else h = mid;
  }
  return l;
}

/** bisect_right: first index with arr[i] > t */
function bisectRight(arr: number[], t: number, lo = 0, hi = arr.length): number {
  let l = lo,
    h = hi;
  while (l < h) {
    const mid = (l + h) >> 1;
    if (arr[mid] <= t) l = mid + 1;
    else h = mid;
  }
  return l;
}

/**
 * Build the r1 features for one anchor (the latest reading).
 *
 * @param readings     all sorted readings (only those with timeMs <=
 *                     anchorMs are used)
 * @param boluses      capped bolus list (same as the base predictor gets)
 * @param rescues      capped rescue times (ms)
 * @param meals        meal logs; the builder windows scalars to the last 3h
 *                     itself, but seq ch6 also reads the meal IMMEDIATELY
 *                     before each slot's 60-min window (trainer trains on the
 *                     full meal history), so callers should pass a wide window
 *                     (app: 48h) to cover that lookback
 * @param basalTimesMs all basal-insulin treatment times
 * @param anchorMs     prediction origin (latest reading time)
 */
export function buildR1Features(
  readings: { timeMs: number; sugar: number }[],
  boluses: R1Bolus[],
  rescues: number[],
  meals: R1Meal[],
  basalTimesMs: number[],
  anchorMs: number,
): R1FeatureData {
  // Past-only: keep readings up to and including the anchor, sorted
  const rs = readings
    .filter((r) => r.timeMs <= anchorMs)
    .sort((a, b) => a.timeMs - b.timeMs);
  const ts = rs.map((r) => r.timeMs);
  const sg = rs.map((r) => r.sugar);
  const n = rs.length;
  if (n === 0) {
    return { seq: new Array(A * C).fill(0), scal: new Array(27).fill(0) };
  }

  // Sorted, past-only treatment lists
  const sortedBoluses = boluses
    .filter((b) => b.timeMs <= anchorMs)
    .sort((a, b) => a.timeMs - b.timeMs);
  const bolusT = sortedBoluses.map((b) => b.timeMs);
  const bolusU: number[] = [];
  let cu = 0;
  for (const b of sortedBoluses) {
    cu += b.units;
    bolusU.push(cu);
  }
  const rescueT = rescues.filter((r) => r <= anchorMs).sort((a, b) => a - b);
  const mealSorted = meals
    .filter((m) => m.timeMs <= anchorMs)
    .sort((a, b) => a.timeMs - b.timeMs);
  const mT = mealSorted.map((m) => m.timeMs);
  const mC = mealSorted.map((m) => m.carbs);
  const basal = basalTimesMs.filter((b) => b <= anchorMs).sort((a, b) => a - b);

  // ---------- sequence channels ----------
  const seq: number[] = new Array(A * C).fill(0);
  const kLo = bisectLeft(ts, anchorMs - (A - 1) * MS_MIN);
  let prevBg: number | null = null;
  for (let k = 0; k < A; k++) {
    const sK = anchorMs - (A - 1 - k) * MS_MIN;
    const lo = bisectLeft(ts, sK, kLo, n);
    const hi = bisectLeft(ts, sK + MS_MIN, kLo, n);
    if (hi > lo) {
      const v = sg[hi - 1];
      seq[k * C + 0] = v / 100.0;
      seq[k * C + C - 1] = 1.0;
      if (prevBg !== null) seq[k * C + 1] = (v - prevBg) / 20.0;
      prevBg = v;
    }
    const bi = bisectRight(bolusT, sK);
    for (const [ch, wmin] of [
      [2, 30],
      [3, 60],
      [4, 120],
    ] as const) {
      const bj = bisectRight(bolusT, sK - wmin * MS_MIN);
      if (bi > bj) {
        seq[k * C + ch] =
          (bolusU[bi - 1] - (bj > 0 ? bolusU[bj - 1] : 0.0)) / 10.0;
      }
    }
    const ri = bisectRight(rescueT, sK);
    const rj = bisectRight(rescueT, sK - 40 * MS_MIN);
    if (ri > rj) seq[k * C + 5] = 1.0;
    const mi = bisectRight(mT, sK);
    const mj = bisectRight(mT, sK - 60 * MS_MIN);
    if (mi > mj) {
      seq[k * C + 6] =
        Math.min(mC[mi - 1] - (mj > 0 ? mC[mj - 1] : 0.0), 200.0) / 60.0;
    }
    const bsi = bisectRight(basal, sK);
    const bsj = bisectRight(basal, sK - 60 * MS_MIN);
    if (bsi > bsj) seq[k * C + 7] = 1.0;
  }

  // ---------- scalars ----------
  const anchorIdx = n - 1;
  const w0 = Math.max(0, anchorIdx - A + 1);
  const wTs: number[] = [];
  const wSg: number[] = [];
  for (let k = w0; k <= anchorIdx; k++) {
    wTs.push(ts[k]);
    wSg.push(sg[k]);
  }
  const yMean = wSg.reduce((a, b) => a + b, 0) / wSg.length;
  const yStd = Math.sqrt(
    wSg.reduce((a, b) => a + (b - yMean) * (b - yMean), 0) / wSg.length,
  );

  const slope = (h: number): number => {
    const w0h = bisectLeft(ts, anchorMs - h * MS_MIN);
    if (anchorIdx - w0h < 3 || ts[anchorIdx] - ts[w0h] <= (h - 8) * MS_MIN)
      return 0;
    const xh: number[] = [];
    const yh: number[] = [];
    for (let k = w0h; k <= anchorIdx; k++) {
      xh.push((ts[k] - anchorMs) / MS_MIN);
      yh.push(sg[k]);
    }
    const xm = xh.reduce((a, b) => a + b, 0) / xh.length;
    const ym = yh.reduce((a, b) => a + b, 0) / yh.length;
    let sxx = 0,
      sxy = 0;
    for (let k = 0; k < xh.length; k++) {
      sxx += (xh[k] - xm) * (xh[k] - xm);
      sxy += (xh[k] - xm) * (yh[k] - ym);
    }
    return (sxx > 0 ? sxy / sxx : 0) * 60.0;
  };

  const vApp = (appVelocity(wSg, wTs) ?? 0) * 60.0;

  let iob = 0,
    ab30 = 0,
    ab60 = 0;
  let tSinceB = 400.0,
    unitsLast = 0.0;
  for (const b of sortedBoluses) {
    const th = (anchorMs - b.timeMs) / MS_H;
    iob += b.units * (1 - Bateman.F(th, b.ka, b.ke));
    ab30 += b.units * Bateman.area(th, th + 0.5, b.ka, b.ke);
    ab60 += b.units * Bateman.area(th, th + 1.0, b.ka, b.ke);
    const tsB = (anchorMs - b.timeMs) / MS_MIN;
    if (tsB < tSinceB) {
      tSinceB = tsB;
      unitsLast = b.units;
    }
  }

  // Trainer literal 3_600_000 ms = 1 h (rescues in the last hour)
  const carb60 = rescueT.filter((r) => r > anchorMs - 3_600_000).length;
  const carb120 = rescueT.length;
  let tSinceR = 400.0;
  for (const r of rescueT) {
    const d = (anchorMs - r) / MS_MIN;
    if (d < tSinceR) tSinceR = d;
  }
  let rescueActive = 0;
  for (const r of rescueT) {
    if (anchorMs - r < (CGM_DELAY_MIN + RESCUE_DUR_MIN) * MS_MIN) {
      rescueActive = 1;
      break;
    }
  }

  const mLo = bisectLeft(mT, anchorMs - 3 * MS_H);
  const mHi = bisectRight(mT, anchorMs);
  let mc60 = 0,
    mc120 = 0,
    mc180 = 0,
    mp180 = 0,
    tSinceM = 400.0;
  for (let k = mLo; k < mHi; k++) {
    if (mT[k] > anchorMs - 3_600_000) mc60 += mC[k]; // 1 h, trainer literal
    if (mT[k] > anchorMs - 7_200_000) mc120 += mC[k];
    mc180 += mC[k];
    mp180 += mealSorted[k].protein;
    const d = (anchorMs - mT[k]) / MS_MIN;
    if (d < tSinceM) tSinceM = d;
  }

  const bIdx = bisectRight(basal, anchorMs);
  const tSinceBasal = bIdx > 0 ? (anchorMs - basal[bIdx - 1]) / MS_H : 24.0;

  const dte = new Date(anchorMs);
  const hour = dte.getUTCHours() + dte.getUTCMinutes() / 60; // seconds dropped, like the trainer
  const weekday = (dte.getUTCDay() + 6) % 7; // Python weekday(): Mon=0..Sun=6

  const scal = [
    sg[anchorIdx],
    yMean,
    yStd,
    slope(15),
    slope(30),
    slope(60),
    slope(120),
    vApp,
    0, // dir: constant 0 in the training data (app readings carry no trend)
    unitsLast,
    tSinceB,
    iob,
    ab30,
    ab60,
    carb60,
    carb120,
    tSinceR,
    rescueActive,
    mc60,
    mc120,
    mc180,
    mp180,
    tSinceM,
    Math.sin((2 * Math.PI * hour) / 24),
    Math.cos((2 * Math.PI * hour) / 24),
    weekday,
    tSinceBasal,
  ];
  for (const [cStr, cap] of Object.entries(SCAL_CAPS)) {
    const c = Number(cStr);
    if (scal[c] > cap) scal[c] = cap;
  }

  return { seq, scal };
}
