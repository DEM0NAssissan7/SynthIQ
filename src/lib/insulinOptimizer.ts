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
import Unit from "../models/unit";
import { PreferencesStore } from "../storage/preferencesStore";
import { getHourDiff, getTimestampFromOffset } from "./timing";
import { convertDimensions, MathUtil } from "./util";

export function mealDeltaBG(
  refTimestamp: Date,
  t: number, // Hours
  insulins: Insulin[],
  glucoses: Glucose[],
  snapshot: Snapshot | null,
) {
  const timestamp = getTimestampFromOffset(refTimestamp, t);

  const insulinEffect = insulins.reduce(
    (n, insulin) =>
      n +
      insulin.batemanIntegral(refTimestamp, timestamp) * insulin.variant.effect,
    0,
  );
  const rescueEffect = glucoses.reduce((total, g) => {
    const minutes =
      (timestamp.getTime() - g.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Minute);
    if (minutes <= 0) return total;
    const absorbed = Math.min(minutes / g.variant.duration, 1);
    return total + absorbed * g.value * g.variant.effect;
  }, 0);

  let deltaBG = 0;
  if (snapshot !== null) {
    const initialBG = snapshot.getSmoothed(refTimestamp);
    const finalBG = snapshot.getSmoothed(timestamp);
    deltaBG = finalBG - initialBG;
  }
  return deltaBG + insulinEffect - rescueEffect;
}
export interface ForecastDose {
  units: number;
  desiredUnits: number; // What it would take to land on target
  maxUnits: number; // The most the low limit allows
  landingBG: number; // Estimated BG one insulin duration from now, with no further dose
  limitHours: number; // Hours from now to the moment that sets maxUnits
  limitBG: number; // Estimated BG at that moment, with no further dose
  limitFloor: number; // The BG we aren't allowed to go under
  limitFraction: number; // How much of this dose would've absorbed by then
}
function sessionMealDeltaBG(t: number, session: Session) {
  return mealDeltaBG(
    session.timestamp,
    t,
    session.insulins,
    session.glucoses,
    session.snapshot,
  );
}

export function forecastDose(
  baseSessions: Session[],
  takenInsulins: Insulin[],
  takenRescues: Glucose[],
  BG: number,
  refTimestamp: Date,
  timestamp: Date,
  variant: InsulinVariant,
  targetBG: number = PreferencesStore.targetBG.value,
  lowBG: number = PreferencesStore.lowBG.value +
    PreferencesStore.lowBuffer.value,
): ForecastDose {
  const tNow = getHourDiff(timestamp, refTimestamp);
  // We pull out the average curve from all the sessions we have
  const allDeltas = (a: number, b: number) =>
    baseSessions.map(
      (s) => sessionMealDeltaBG(b, s) - sessionMealDeltaBG(a, s),
    );
  const compositeRef = (a: number, b: number) => MathUtil.mean(allDeltas(a, b));
  // const refEnd = MathUtil.mean(baseSessions.map((s) => s.length));

  // This session's treatments on the REAL clock: (insulin pull - rescue push)
  const treatments = (a: number, b: number) =>
    mealDeltaBG(refTimestamp, b, takenInsulins, takenRescues, null) -
    mealDeltaBG(refTimestamp, a, takenInsulins, takenRescues, null);

  const mealTime = (t: number) => t;

  // Forecast: anchored at BG, meal warped, treatments not
  const estimatedBG = (t: number) =>
    BG + compositeRef(mealTime(tNow), mealTime(t)) - treatments(tNow, t);

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
  const { maxUnits, limitHours } = (() => {
    // We sample every 5 mins to see how far low we go & how much units it allows us, then we get the minimum of that
    let min = Infinity;
    let limitHours = 0;
    const step = 5 / 60;
    const peakHours =
      variant.ka === variant.ke
        ? 1 / variant.ka
        : Math.log(variant.ka / variant.ke) / (variant.ka - variant.ke);
    for (let i = peakHours; i < variant.duration; i += step) {
      // 'i' is in hours from now
      const t = tNow + i;
      const units = maxUnitsAt(t);
      if (units < min) {
        min = units;
        limitHours = i;
      }
    }
    return { maxUnits: min, limitHours };
  })();
  // We figure out what we want in order to land on targetBG exactly
  const desiredUnits =
    (estimatedBG(tNow + variant.duration) - targetBG) /
    (variant.effect * variant.unitBatemanIntegral(0, variant.duration));
  const units = Math.max(0, Math.min(desiredUnits, maxUnits));
  return {
    units,
    desiredUnits,
    maxUnits,
    landingBG: estimatedBG(tNow + variant.duration),
    limitHours,
    limitBG: estimatedBG(tNow + limitHours),
    limitFloor: Math.min(lowBG, BG),
    limitFraction: variant.unitBatemanIntegral(0, limitHours),
  };
}

export function forecastUnits(...args: Parameters<typeof forecastDose>) {
  return forecastDose(...args).units;
}

export interface ReplayedDose {
  insulin: Insulin;
  BG: number; // What blood sugar read when this dose was solved
  forecast: ForecastDose; // Why the forecast gave what it gave, before any profile offset
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
  const doses = [...session.insulins].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const virtualInsulins: Insulin[] = [];
  return doses.map(({ timestamp, variant }, doseIndex) => {
    const t = getHourDiff(timestamp, refTimestamp);
    // What BG would've been: the real trace, swapping the real treatments for the virtual ones
    const BG =
      session.snapshot.getReading(timestamp).sugar +
      mealDeltaBG(refTimestamp, t, session.insulins, session.glucoses, null) -
      mealDeltaBG(refTimestamp, t, virtualInsulins, [], null);
    const forecast = forecastDose(
      references,
      virtualInsulins,
      [],
      BG,
      refTimestamp,
      timestamp,
      variant,
      targetBG,
      lowBG,
    );
    const profileUnits = (profileRises[doseIndex] ?? 0) / variant.effect;
    const insulin = new Insulin(
      Math.max(0, forecast.units + profileUnits),
      timestamp,
      variant,
    );
    virtualInsulins.push(insulin);
    return { insulin, BG, forecast };
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
