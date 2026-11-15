/**
 * Uses current metabolic information to make a prediction about the user BG level at any given time
 */

import Glucose from "../models/events/glucose";
import Insulin from "../models/events/insulin";
import { InsulinVariant } from "../models/types/insulinVariant";
import SugarReading from "../models/types/sugarReading";
import { RescueVariant } from "../models/types/rescueVariant";
import Unit from "../models/unit";
import { convertDimensions, MathUtil } from "./util";
import { estimateDynamicISF } from "./helpers/estimateDynamicISF";
import { getTimestampFromOffset } from "./timing";
import { buildR1Features } from "./r1/r1Features";
import { applyR1 } from "./r1/r1Core";
import { r1Weights } from "./r1/weights";

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

/**
 * ⚠ LOCKED BASE PREDICTOR — do not modify this function.
 *
 * This is the base algorithm that r1 (the residual-corrector neural net,
 * src/lib/r1/) was trained against. It is pinned by
 * r1Weights.base_version.ts_sha256 and checked at runtime by
 * isBaseVersionValid(). Any behavioral change here invalidates r1 and the
 * correction is automatically turned off (getPredictedGlucose falls back to
 * this function's raw output).
 */
export function getBasePredictedGlucose(
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
    const predicted = getBasePredictedGlucose(
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
      const prediction = getBasePredictedGlucose(
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

// ============================================================================
// r1 — neural residual correction on top of the locked base predictor
// ============================================================================
//
// The r1 GRU+MLP model (src/lib/r1/) learned the RESIDUAL of getBasePredictedGlucose
// on the user's own CGM history (nightscout-analysis, models/r1/). It does not
// replace the base algorithm — it only corrects its error. Safety properties
// (all enforced in getPredictedGlucose below):
//
//  1. Base-version lock: r1 was trained against the exact base whose sources
//     are pinned in r1Weights.base_version (ts_files + ts_sha256, plus the
//     training-time commit). If the base's behavior ever changes, the
//     behavioral canary (R1_CANARY) fails and the correction is turned off —
//     the raw base number is returned instead.
//  2. Output caps: the correction is clamped to the max |residual| seen in
//     training for the target horizon (r1Weights.caps), so out-of-distribution
//     inputs (overnight NPH, a new insulin, …) can at most add/remove the
//     largest correction the model has ever learned.
//  3. +5 min skipped: at the shortest horizon the correction is pure noise,
//     so the raw base number is returned there (r1Weights.skip_horizons).
//  4. Past-only inputs: every feature (buildR1Features) is computed strictly
//     from data at or before the reference reading.
//
// NOTE on the base input: to stay bit-consistent with the training pipeline,
// the base here is fed the last 36 readings and capped treatment lists
// (boluses ≤ 24 h old, ≤ 16; rescues ≤ 3 h old, ≤ 16) — exactly what the
// trainer (scripts/r1_train.py) fed to the base. Older boluses contribute
// < 0.05 mg/dL, so this is behaviorally equivalent to the pre-r1 app.

const R1_MS_PER_MIN = 60_000;
const R1_BOLUS_LOOKBACK_MS = 24 * 3_600_000;
const R1_RESCUE_LOOKBACK_MS = 3 * 3_600_000;
const R1_MAX_BOLUSES = 16;
const R1_MAX_RESCUES = 16;
const R1_MAX_HORIZON_MIN = 135; // trained horizon 120 + target snap tolerance:
// the trainer labels each anchor with the reading nearest to anchor + h
// (up to ~7 min past in the data), so allow that offset; beyond it the
// nearest trained horizon would be an extrapolation → base only

/**
 * Context needed by r1's scalar features that the base function does not
 * use: logged meals and basal (NPH) treatment times. Everything is
 * optional — when omitted, the affected features degrade gracefully
 * (carbs/protein features = 0, t_since_basal = 24 h).
 */
export interface R1Context {
  /** Logged meals: time in ms, carbs in grams, protein in grams. */
  meals?: { timeMs: number; carbs: number; protein: number }[];
  /** Times (ms) of basal/NPH insulin treatments, any age (capped inside). */
  basalTimesMs?: number[];
}

// --- Base-version behavioral canary ----------------------------------------
// Fixed inputs → fixed expected base output. Recompute the expected value by
// running the canary in node (scripts/parity/) whenever the base is
// legitimately re-locked with a new r1 model.
const R1_CANARY_T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const R1_CANARY_READINGS: SugarReading[] = (() => {
  const out: SugarReading[] = [];
  for (let k = 39; k >= 0; k--) {
    const s = 112 + 3 * ((k * 7) % 13) - Math.floor(k / 10) * 2;
    out.push(new SugarReading(s, new Date(R1_CANARY_T0 - k * 300_000)));
  }
  return out;
})();
const R1_CANARY_INSULINS: Insulin[] = [
  new Insulin(3.5, new Date(R1_CANARY_T0 - 137 * R1_MS_PER_MIN), new InsulinVariant("Insulin", 50, 28, 0.5, 0.7)),
  new Insulin(2.0, new Date(R1_CANARY_T0 - 26 * 3_600_000), new InsulinVariant("Basal", 1.5, 56, 0.01, 0.7)),
];
const R1_CANARY_RESCUES: Glucose[] = [
  new Glucose(15, new Date(R1_CANARY_T0 - 22 * R1_MS_PER_MIN), new RescueVariant("grams carbs", 30, 1, 5)),
];
const R1_CANARY_TARGET_MS = R1_CANARY_T0 + 30 * R1_MS_PER_MIN;
// Base output on the canary inputs, measured on the locked base (see above).
// Measured 2026-11-10 via parity/canary.ts (node, exact app source).
const R1_CANARY_EXPECTED = 94.58678390244351;

let _r1BaseVersionValid: boolean | null = null;

/**
 * True iff the base predictor still behaves exactly as it did when r1 was
 * trained. Cached after the first call (the base is deterministic, so the
 * canary result is stable).
 */
export function isBaseVersionValid(): boolean {
  if (_r1BaseVersionValid === null) {
    try {
      const got = getBasePredictedGlucose(
        R1_CANARY_READINGS,
        new Date(R1_CANARY_TARGET_MS),
        R1_CANARY_INSULINS,
        R1_CANARY_RESCUES,
      );
      _r1BaseVersionValid =
        typeof got === "number" &&
        Math.abs(got - R1_CANARY_EXPECTED) < 0.001;
    } catch {
      _r1BaseVersionValid = false;
    }
  }
  return _r1BaseVersionValid;
}

function r1CappedInsulins(insulins: Insulin[], anchorMs: number): Insulin[] {
  return insulins
    .filter(
      (i) =>
        i.timestamp.getTime() <= anchorMs &&
        anchorMs - i.timestamp.getTime() <= R1_BOLUS_LOOKBACK_MS,
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-R1_MAX_BOLUSES);
}

function r1CappedRescues(rescues: Glucose[], anchorMs: number): Glucose[] {
  return rescues
    .filter(
      (r) =>
        r.timestamp.getTime() <= anchorMs &&
        anchorMs - r.timestamp.getTime() <= R1_RESCUE_LOOKBACK_MS,
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-R1_MAX_RESCUES);
}

/**
 * Predict BG at `timestamp` = locked base prediction + r1 residual correction.
 *
 * Backward compatible: existing 4-arg call sites keep working (the correction
 * is applied with empty meals/basal context). Pass `r1Context` to enable the
 * meal/carb and basal/NPH features.
 *
 * Returns the raw base prediction (or null) whenever the correction cannot
 * be safely applied: base version lock failed, horizon outside the trained
 * range, +5 min (skip set), or a non-finite model output. The correction
 * itself is cap-limited per horizon (see r1Core.applyR1).
 */
export function getPredictedGlucose(
  readings: SugarReading[],
  timestamp: Date,
  insulins: Insulin[],
  rescues: Glucose[],
  r1Context?: R1Context,
  r1Horizon?: number,
): number | null {
  if (readings.length < 2) return null;
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const anchorMs =
    sortedReadings[sortedReadings.length - 1].timestamp.getTime();

  // Base: trained input shape (last 36 readings, capped treatments).
  const cappedInsulins = r1CappedInsulins(insulins, anchorMs);
  const cappedRescues = r1CappedRescues(rescues, anchorMs);
  const base = getBasePredictedGlucose(
    sortedReadings.slice(-36),
    timestamp,
    cappedInsulins,
    cappedRescues,
  );
  if (base === null || !isBaseVersionValid()) return base;

  const dMin = (timestamp.getTime() - anchorMs) / R1_MS_PER_MIN;
  if (dMin <= 0 || dMin > R1_MAX_HORIZON_MIN) return base;

  // Snap to the nearest trained horizon (drives cap + skip set). Ties go to
  // the later horizon, matching the trainer's per-horizon target labeling.
  // An explicit `r1Horizon` (a trained horizon) overrides the snap.
  let horizon = 0;
  let bestDist = Infinity;
  for (const h of r1Weights.horizons) {
    const d = Math.abs(h - dMin);
    if (d <= bestDist) {
      bestDist = d;
      horizon = h;
    }
  }
  if (r1Horizon != null && r1Weights.horizons.includes(r1Horizon)) {
    horizon = r1Horizon;
  }
  if (horizon === 0 || r1Weights.skip_horizons.includes(horizon)) return base;

  const feats = buildR1Features(
    sortedReadings.map((r) => ({
      timeMs: r.timestamp.getTime(),
      sugar: r.sugar,
    })),
    cappedInsulins.map((i) => ({
      timeMs: i.timestamp.getTime(),
      units: i.value,
      ka: i.variant.ka,
      ke: i.variant.ke,
    })),
    cappedRescues.map((r) => r.timestamp.getTime()),
    r1Context?.meals ?? [],
    r1Context?.basalTimesMs ?? [],
    anchorMs,
  );
  if (feats === null) return base;

  const resid = applyR1(
    Array.from(feats.seq),
    Array.from(feats.scal),
    base,
    horizon,
  );
  if (resid === null) return base;
  return base + resid;
}
