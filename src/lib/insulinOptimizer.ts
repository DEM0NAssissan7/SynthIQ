/**
 * This is a fundamental change to the optimizer.
 * When we are wanting to understand the optimal behavior of a dose, we
 * are almost never trying to look at the entire meal as a composite of insulins.
 * We are typically looking only for a dose we want at a certain timestamp.
 * This is the fundamental change from the old optimizer. Instead of finding a naive
 * "optimal insulins" in a closed box, we instead shift our focus to trying to find the
 * optimal dose to take *right now* without causing a crash
 */

import type Glucose from "../models/events/glucose";
import type Insulin from "../models/events/insulin";
import type Session from "../models/session";
import type Snapshot from "../models/snapshot";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { PreferencesStore } from "../storage/preferencesStore";
import {
  getHourDiff,
  getTimestampFromOffset,
  timestampIsBetween,
} from "./timing";

function mealDeltaBG(
  tA: number, // Hours
  tB: number, // Hours
  insulins: Insulin[],
  glucoses: Glucose[],
  snapshot: Snapshot | null,
  refTimestamp: Date,
) {
  const timestampA = getTimestampFromOffset(refTimestamp, tA);
  const timestampB = getTimestampFromOffset(refTimestamp, tB);

  const insulinEffect = insulins.reduce(
    (n, insulin) =>
      n +
      insulin.batemanIntegral(timestampA, timestampB) * insulin.variant.effect,
    0,
  );
  const rescueEffect = glucoses.reduce(
    (a, g) =>
      timestampIsBetween(g.timestamp, timestampA, timestampB)
        ? a + g.value * g.variant.effect
        : a,
    0,
  );
  let deltaBG = 0;
  if (snapshot !== null) {
    const initialBG = snapshot.getSmoothed(timestampA);
    const finalBG = snapshot.getSmoothed(timestampB);
    deltaBG = finalBG - initialBG;
  }
  return deltaBG + insulinEffect - rescueEffect;
}
/**
 * Finds the earliest x in [start, end] where fn(x) reaches target.
 * Returns null if fn never reaches it within the range.
 */
function solveFor(
  target: number,
  fn: (x: number) => number,
  start: number,
  end: number,
  step = 5 / 60,
  tolerance = 30 / 3600,
): number | null {
  if (fn(start) >= target) return start;

  // 1. Coarse scan: find the first step where fn crosses the target
  let lo = start;
  let hi = Math.min(start + step, end);
  while (fn(hi) < target) {
    if (hi >= end) return null;
    lo = hi;
    hi = Math.min(hi + step, end);
  }

  // 2. Bisect inside that one step down to tolerance
  while (hi - lo > tolerance) {
    const mid = (lo + hi) / 2;
    if (fn(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}
export function forecastUnits(
  refSession: Session,
  takenInsulins: Insulin[],
  takenRescues: Glucose[],
  initialBG: number,
  BG: number,
  refTimestamp: Date,
  timestamp: Date,
  variant: InsulinVariant,
) {
  const actualDelta = BG - initialBG;
  const tNow = getHourDiff(timestamp, refTimestamp);
  const refEnd = getHourDiff(refSession.snapshot.endTime, refSession.timestamp);

  // Reference meal push, on the reference's meal clock
  const refMeal = (a: number, b: number) =>
    mealDeltaBG(
      a,
      b,
      refSession.insulins,
      refSession.glucoses,
      refSession.snapshot,
      refSession.timestamp,
    );

  // This session's treatments on the REAL clock: (insulin pull - rescue push)
  const treatments = (a: number, b: number) =>
    mealDeltaBG(a, b, takenInsulins, takenRescues, null, refTimestamp);

  // How much meal has actually landed this session
  const landed = actualDelta + treatments(0, tNow);

  // Where the train is on the reference track
  const tMealNow = solveFor(landed, (x) => refMeal(0, x), 0, refEnd) ?? refEnd;
  const scale = tNow > 0 ? Math.min(2, Math.max(0.5, tMealNow / tNow)) : 1;
  const mealTime = (t: number) => Math.min(t * scale, refEnd);

  // Forecast: anchored at BG, meal warped, treatments not
  const estimatedBG = (t: number) =>
    BG + refMeal(mealTime(tNow), mealTime(t)) - treatments(tNow, t);

  // Our definition of our target dose is to not go low while taking as much insulin now as possible, or hitting the targetBG dead-on
  const targetBG = PreferencesStore.targetBG.value;
  const lowBG = PreferencesStore.lowBG.value;
  const maxUnitsAt = (t: number) => {
    const bg = estimatedBG(t);
    const fractionAbsorbed = variant.unitBatemanIntegral(0, t - tNow);
    const distanceToLow = bg - lowBG;
    const unitsAbsorbedToLow = distanceToLow / variant.effect;
    return fractionAbsorbed > 0
      ? unitsAbsorbedToLow / fractionAbsorbed
      : Infinity;
  };
  const maxUnits = (() => {
    // We sample every 5 mins to see how far low we go & how much units it allows us, then we get the minimum of that
    let min = Infinity;
    const step = 5 / 60;
    for (let i = step; i < variant.duration; i += step) {
      // 'i' is in hours from now
      const t = tNow + i;
      const units = maxUnitsAt(t);
      if (units < min) {
        min = units;
      }
    }
    return min;
  })();
  // We figure out, out to infinity, what we want in order to land on targetBG exactly
  const desiredUnits =
    (estimatedBG(tNow + variant.duration) - targetBG) /
    (variant.effect * variant.unitBatemanIntegral(0, variant.duration));
  const units = Math.max(0, Math.min(desiredUnits, maxUnits));
  return units;
}
