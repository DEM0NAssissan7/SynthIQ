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
  // Like the insulin, only what absorbed between refTimestamp and timestamp (a rescue can come before the meal)
  const rescueEffect = glucoses.reduce((total, g) => {
    const absorbedBy = (time: Date) => {
      const minutes =
        (time.getTime() - g.timestamp.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Minute);
      return minutes <= 0 ? 0 : Math.min(minutes / g.variant.duration, 1);
    };
    const absorbed = absorbedBy(timestamp) - absorbedBy(refTimestamp);
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
/**
 * A session's meal curve, denoised. A meal can only ever add glucose, so its running total
 * never goes down: wherever the raw curve falls, it's noise (or the treatments being off).
 * We fit the closest never-decreasing curve to it, sampled every 5 mins, over the session's readings.
 */
function sessionMealCurve(session: Session): (t: number) => number {
  const raw = (t: number) =>
    mealDeltaBG(
      session.mealTimestamp,
      t,
      session.insulins,
      session.glucoses,
      session.snapshot,
    );
  const readings = session.snapshot.readings;
  if (readings.length === 0) return raw;
  const end = getHourDiff(
    readings[readings.length - 1].timestamp,
    session.mealTimestamp,
  );
  const step = 5 / 60;
  const count = Math.ceil(end / step);
  if (count < 1) return raw;

  // times[0] is the start of the session, where the meal hasn't added anything yet
  const times = [0];
  for (let i = 1; i <= count; i++) times.push(Math.min(i * step, end));
  const fit = [
    0,
    ...MathUtil.isotonicLinear(times.slice(1).map(raw)).map((v) =>
      Math.max(v, 0),
    ),
  ];
  const rawEnd = raw(end);

  return (t: number) => {
    if (t <= 0) return raw(t);
    // Past the last reading only the treatments keep changing, same as the raw curve
    if (t >= end) return fit[count] + raw(t) - rawEnd;
    const i = Math.floor(t / step);
    const f = (t - times[i]) / (times[i + 1] - times[i]);
    return fit[i] + f * (fit[i + 1] - fit[i]);
  };
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
  const mealCurves = baseSessions.map(sessionMealCurve);
  const allDeltas = (a: number, b: number) =>
    mealCurves.map((curve) => curve(b) - curve(a));
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

  // A dose's size changes its own curve (and so its peak and duration), so below, every dose
  // we consider is judged against its own curve. Small doses all share the reference curve.

  // Our definition of our target dose is to not go low while taking as much insulin now as possible, or hitting the targetBG dead-on
  const floor = Math.min(lowBG, BG);
  // We sample every 5 mins from the earliest peak any dose can have (a bigger dose only peaks later)
  const step = 5 / 60;
  const firstPeak = variant.getPeak(0);
  const samples: { hours: number; bg: number }[] = []; // 'hours' is from now
  const sample = (k: number) => {
    while (samples.length <= k) {
      const hours = firstPeak + samples.length * step;
      samples.push({ hours, bg: estimatedBG(tNow + hours) });
    }
    return samples[k];
  };
  // The moment that allows the fewest units before we hit the floor, with a curve shaped like `dose`'s,
  // between that dose's own peak and the end of its duration
  const limitOf = (dose: number) => {
    const start = variant.getPeak(dose);
    const end = variant.getDuration(dose);
    let units = Infinity;
    let hours = 0;
    for (let k = 0; firstPeak + k * step < end; k++) {
      const s = sample(k);
      if (s.hours < start) continue;
      const fraction = variant.unitBatemanIntegral(0, s.hours, dose);
      if (!(fraction > 0)) continue;
      const unitsToFloor = (s.bg - floor) / variant.effect / fraction;
      if (unitsToFloor < units) {
        units = unitsToFloor;
        hours = s.hours;
      }
    }
    return { units, hours };
  };
  const { maxUnits, limitHours } = (() => {
    // The limit for a dose with the reference curve is exact for anything at or under zero
    const reference = limitOf(0);
    if (!(reference.units > 0) || !Number.isFinite(reference.units))
      return { maxUnits: reference.units, limitHours: reference.hours };
    // Otherwise it's the biggest dose that stays above the floor on its own curve
    const maxUnits = MathUtil.largestWhere(
      (dose) => limitOf(dose).units >= dose,
      reference.units,
    );
    return { maxUnits, limitHours: limitOf(maxUnits).hours };
  })();

  // We figure out what we want in order to land on targetBG exactly once the dose is done
  const landingBGFor = (dose: number) => {
    const duration = variant.getDuration(dose);
    return (
      estimatedBG(tNow + duration) -
      dose * variant.effect * variant.unitBatemanIntegral(0, duration, dose)
    );
  };
  const desiredUnits = (() => {
    // A dose with the reference curve is a straight division, exact for anything at or under zero
    const referenceDuration = variant.getDuration(0);
    const reference =
      (estimatedBG(tNow + referenceDuration) - targetBG) /
      (variant.effect * variant.unitBatemanIntegral(0, referenceDuration, 0));
    if (!(reference > 0)) return reference;
    // Otherwise it's the biggest dose that doesn't land under target on its own curve
    return MathUtil.largestWhere(
      (dose) => landingBGFor(dose) >= targetBG,
      reference,
    );
  })();

  const units = Math.max(0, Math.min(desiredUnits, maxUnits));
  return {
    units,
    desiredUnits,
    maxUnits,
    landingBG: estimatedBG(tNow + variant.getDuration(units)),
    limitHours,
    limitBG: estimatedBG(tNow + limitHours),
    limitFloor: floor,
    // Explains maxUnits: (limitBG - limitFloor) / effect / limitFraction
    limitFraction: variant.unitBatemanIntegral(0, limitHours, maxUnits),
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
  const refTimestamp = session.mealTimestamp;
  const doses = [...session.insulins].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  // Treatments can come before the meal (pre-bolus), so they're counted from the start of the session
  const start = session.timestamp;
  const virtualInsulins: Insulin[] = [];
  return doses.map(({ timestamp, variant }, doseIndex) => {
    const t = getHourDiff(timestamp, start);
    // What BG would've been: the real trace, swapping the real treatments for the virtual ones
    const BG =
      session.snapshot.getReading(timestamp).sugar +
      mealDeltaBG(start, t, session.insulins, session.glucoses, null) -
      mealDeltaBG(start, t, virtualInsulins, [], null);
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
