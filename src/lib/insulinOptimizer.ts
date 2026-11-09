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
import Insulin from "../models/events/insulin";
import type Session from "../models/session";
import type Snapshot from "../models/snapshot";
import type { InsulinVariant } from "../models/types/insulinVariant";
import { PreferencesStore } from "../storage/preferencesStore";
import {
  getHourDiff,
  getTimestampFromOffset,
  timestampIsBetween,
} from "./timing";
import { MathUtil } from "./util";

export function mealDeltaBG(
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
  baseSessions: Session[],
  takenInsulins: Insulin[],
  takenRescues: Glucose[],
  initialBG: number,
  BG: number,
  refTimestamp: Date,
  timestamp: Date,
  variant: InsulinVariant,
  targetBG: number = PreferencesStore.targetBG.value,
  lowBG: number = PreferencesStore.lowBG.value +
    PreferencesStore.lowBuffer.value,
) {
  const actualDelta = BG - initialBG;
  const tNow = getHourDiff(timestamp, refTimestamp);
  // We pull out the average curve from all the sessions we have
  const allDeltas = (a: number, b: number) =>
    baseSessions.map((s) =>
      mealDeltaBG(a, b, s.insulins, s.glucoses, s.snapshot, s.timestamp),
    );
  const compositeRef = (a: number, b: number) =>
    MathUtil.median(allDeltas(a, b));
  // const refEnd = MathUtil.mean(baseSessions.map((s) => s.length));

  // This session's treatments on the REAL clock: (insulin pull - rescue push)
  const treatments = (a: number, b: number) =>
    mealDeltaBG(a, b, takenInsulins, takenRescues, null, refTimestamp);

  // How much meal has actually landed this session
  const landed = actualDelta + treatments(0, tNow);
  const predicted = compositeRef(0, tNow);
  const tPredict =
    solveFor(landed, (t) => compositeRef(0, t), 0, tNow * 2) ?? tNow;
  const mT = 1;
  const bT = 0;
  const mDelta = 1;
  const bDelta = 0;

  const mealTime = (t: number) => t * mT + bT;

  // Forecast: anchored at BG, meal warped, treatments not
  const estimatedBG = (t: number) =>
    BG +
    mDelta * compositeRef(mealTime(tNow), mealTime(t)) -
    treatments(tNow, t) +
    bDelta;

  // Our definition of our target dose is to not go low while taking as much insulin now as possible, or hitting the targetBG dead-on
  const maxUnitsAt = (t: number) => {
    const bg = estimatedBG(t);
    const fractionAbsorbed = variant.unitBatemanIntegral(0, t - tNow);
    const distanceToLow = bg - Math.min(lowBG, BG);
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

export interface ReplayedDose {
  insulin: Insulin;
  BG: number; // What blood sugar read when this dose was solved
}

/**
 * Follows a session one dose at a time, forecasting from `reference`, in a virtual world
 * where every earlier dose was injected exactly as solved and no rescues were needed.
 * Each dose only sees what came before it.
 * @param profileRises The rise from food the references didn't have, for each dose in order
 * @returns One dose per insulin in the session, in time order
 */
export function replayForecast(
  session: Session,
  references: Session[],
  targetBG: number = PreferencesStore.targetBG.value,
  lowBG: number = PreferencesStore.lowBG.value +
    PreferencesStore.lowBuffer.value,
  profileRises: number[] = [],
): ReplayedDose[] {
  const refTimestamp = session.timestamp;
  const initialBG =
    session.initialGlucose ?? session.snapshot.getSmoothed(refTimestamp);
  const doses = [...session.insulins].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const virtualInsulins: Insulin[] = [];
  return doses.map(({ timestamp, variant }, doseIndex) => {
    const t = getHourDiff(timestamp, refTimestamp);
    // What BG would've been: the real trace, swapping the real treatments for the virtual ones
    const BG =
      session.snapshot.getReading(timestamp).sugar +
      mealDeltaBG(
        0,
        t,
        session.insulins,
        session.glucoses,
        null,
        refTimestamp,
      ) -
      mealDeltaBG(0, t, virtualInsulins, [], null, refTimestamp);
    const units = forecastUnits(
      references,
      virtualInsulins,
      [],
      initialBG,
      BG,
      refTimestamp,
      timestamp,
      variant,
      targetBG,
      lowBG,
    );
    const profileUnits = (profileRises[doseIndex] ?? 0) / variant.effect;
    const insulin = new Insulin(
      Math.max(0, units + profileUnits),
      timestamp,
      variant,
    );
    virtualInsulins.push(insulin);
    return { insulin, BG };
  });
}

/**
 * The doses a session "should've" had according to the forecast, with full hindsight:
 * the session is its own reference, so the forecast knows exactly how its meal behaved.
 */
export function retrospectiveForecast(
  session: Session,
  sessions: Session[],
  targetBG?: number,
  lowBG?: number,
): Insulin[] {
  return replayForecast(session, sessions, targetBG, lowBG).map(
    (dose) => dose.insulin,
  );
}
