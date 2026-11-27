import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { SessionManager } from "../managers/sessionManager";
import { StreamManager } from "../managers/streamManager";
import type Glucose from "../models/events/glucose";
import type Insulin from "../models/events/insulin";
import type Session from "../models/session";
import type { Stream } from "../models/stream";
import type SugarReading from "../models/types/sugarReading";
import { ReadingType } from "../models/types/sugarReading";
import type { DateRange } from "../models/types/types";
import Unit from "../models/unit";
import { BackendStore } from "../storage/backendStore";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PrivateStore } from "../storage/privateStore";
import { getBGVelocities } from "./readingsUtil";
import { getTimestampFromOffset, timestampIsBetween } from "./timing";
import { convertDimensions, MathUtil } from "./util";

/**
 * When the user was not fasting: the active time of every treatment, plus the
 * span of every meal session. Basal insulin never counts: fasting is measured
 * against it.
 */
function getNonFastingWindows(
  stream: Stream,
  ignoreGlucose: boolean = false,
): DateRange[] {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;

  let nonFasting: DateRange[] = []; // A set of date pairs to describe when we are not fasting
  const push = (timestamp: Date, hoursNonFasting: number) =>
    nonFasting.push([
      timestamp,
      getTimestampFromOffset(timestamp, hoursNonFasting),
    ]);
  stream.meals.forEach((m) => push(m.timestamp, minTimeSinceMeal));
  stream.insulins.forEach((i) => push(i.timestamp, i.duration));
  if (!ignoreGlucose)
    stream.rescues.forEach(
      (g) => push(g.timestamp, g.variant.duration / 60), // Convert from minutes to hours
    );
  stream.activities.forEach((a) => push(a.timestamp, a.value / 60));
  nonFasting.push(...getSessionWindows());
  return nonFasting;
}
function getSessionWindows(): DateRange[] {
  const hours = InsulinVariantManager.getBasalVariant().duration;
  let sessions = SessionManager.getSessions();
  sessions.sort(
    (a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
  sessions = sessions.filter(
    (s) => s.age * convertDimensions(Unit.Time.Day, Unit.Time.Hour) <= hours,
  );
  return sessions.map((s) => [s.timestamp, s.endTimestamp ?? new Date()]);
}
function isFasting(timestamp: Date, nonFasting: DateRange[]): boolean {
  for (let datePair of nonFasting) {
    const timestampA = datePair[0];
    const timestampB = datePair[1];
    if (timestampIsBetween(timestamp, timestampA, timestampB)) return false;
  }
  return true;
}
/** The stream over the last basal duration: the window fasting is measured over */
function getFastingStream(): Stream {
  const hours = InsulinVariantManager.getBasalVariant().duration;
  const now = new Date();
  return StreamManager.stream.view(getTimestampFromOffset(now, -hours), now);
}
function getFastingVelocities(stream: Stream): number[] {
  let nonFasting = getNonFastingWindows(stream); // A set of date pairs to describe when we are not fasting

  if (PrivateStore.debugLogs.value) console.log(nonFasting);
  const readings = stream.snapshot.readings
    .filter((r) => r.type === ReadingType.Normal) // CGM readings only
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let velocities: number[] = [];
  let currentSet: SugarReading[] = [];
  readings.forEach((reading: SugarReading, index: number) => {
    const fasting = isFasting(reading.timestamp, nonFasting);
    if (fasting) {
      currentSet.push(reading);
    }
    if (!fasting || index === readings.length - 1) {
      if (currentSet.length > 1) {
        const setVelocities = getBGVelocities(currentSet);
        if (setVelocities) velocities.push(...setVelocities);
      }
      currentSet = [];
    }
  });
  return velocities;
}
function getFastingGlucoses(stream: Stream): Glucose[] {
  let nonFasting = getNonFastingWindows(stream, true);
  return stream.rescues.filter((g) => isFasting(g.timestamp, nonFasting));
}

export function getFastingVelocity() {
  const stream = getFastingStream();
  const fastingVelocities = getFastingVelocities(stream);
  if (fastingVelocities.length === 0) return 0; // No data — assume flat
  const averageVelocity = MathUtil.mean(fastingVelocities);

  // We account for correction glucose that had to be taken while fasting
  const hours = getFastingLength(fastingVelocities);
  const fastingGlucoses = getFastingGlucoses(stream);
  let totalFastingGlucoseEffect = 0;
  fastingGlucoses.forEach(
    (g) => (totalFastingGlucoseEffect += (g.value ?? 0) * g.variant.effect),
  );
  if (PrivateStore.debugLogs.value)
    console.log(
      averageVelocity,
      totalFastingGlucoseEffect / hours,
      fastingGlucoses,
    );
  return averageVelocity - totalFastingGlucoseEffect / hours;
}

/**
 * Gives a number of hours that we have been fasting
 */
export function getFastingLength(
  velocities: number[] = getFastingVelocities(getFastingStream()),
) {
  const minutesPerReading = BackendStore.cgmDelay.value;
  const minutes = velocities.length * minutesPerReading;
  const hours = minutes / 60;
  return hours;
}

/** The doses still acting: one basal duration's worth of shots, newest first */
export function getRecentBasals(): Insulin[] {
  const days = InsulinVariantManager.getBasalVariant().duration / 24;
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  return StreamManager.stream.basals.slice(-days * shotsPerDay).reverse();
}
export function getDailyBasal() {
  const doses: Insulin[] = getRecentBasals();
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  if (doses.length < shotsPerDay) return 0; // Not enough data yet
  let sum = 0;
  let days = 0;
  for (let i = 0; i + shotsPerDay <= doses.length; i += shotsPerDay) {
    let totalDose = 0;
    for (let j = i; j < i + shotsPerDay; j++) {
      totalDose += doses[j].value;
    }
    sum += totalDose;
    days++;
  }
  return sum / days;
}
export function getDailyBasalPerShot() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  return getDailyBasal() / shotsPerDay;
}

// Shot patterns
export function getLastShot(): number {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const basals = StreamManager.stream.basals;

  const insulin = basals[basals.length - shotsPerDay];
  return insulin ? insulin.value : 0;
}
/**
 * Shots taken since the dosing pattern last changed: a dose changed when it
 * differs from the dose of the same shot the day before.
 */
function getShotsSinceChange() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const basals = StreamManager.stream.basals;
  let shots = 0;
  for (let i = basals.length - 1; i >= shotsPerDay; i--) {
    shots++;
    if (Math.abs(basals[i].value - basals[i - shotsPerDay].value) > 0.01) break;
  }
  return shots;
}
export function dosingChangeComplete() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const minDays = InsulinVariantManager.getBasalVariant().duration / 24;

  const minShots = shotsPerDay * minDays;
  return getShotsSinceChange() >= minShots;
}
type LiverModel = {
  L: number; // mg/dL per hour (intercept when B=0)
  S: number; // mg/dL per U (sensitivity)
  slope: number; // b in V = a + b*B_hr (so S = -b)
  n: number; // number of points used
};

/**
 * Robustly estimate the linear model:
 *   V = L - S * B_hr
 * where B_hr = (dailyBasal / 24).
 *
 * Uses a Theil–Sen style estimator:
 *   slope b = median of pairwise slopes in V vs B_hr
 *   intercept a = median of (V_i - b*B_i)
 *
 * Returns {L, S, ...} or null if not enough data.
 */
export function estimateLiverModel(
  sessions: Session[],
  minBasalDiffPerDay: number = 1, // bump default for stability
  requireNonNegativeS: boolean = true,
): LiverModel | null {
  // Not implemented yet: no estimate
  sessions;
  minBasalDiffPerDay;
  requireNonNegativeS;
  return null;
}

/**
 * Backwards-compatible function if you only want L.
 */
export function estimateLiverOutput(
  sessions: Session[],
  minBasalDiffPerDay: number = 1,
): number | null {
  const model = estimateLiverModel(sessions, minBasalDiffPerDay, true);
  return model ? model.L : null;
}

export function getBasalSensitivity(
  liverOutputPerHour: number,
  fastingVelocityPerHour: number,
  basalUnitsPerDay: number,
) {
  const basalUnitsPerHour = basalUnitsPerDay / 24;
  return (liverOutputPerHour - fastingVelocityPerHour) / basalUnitsPerHour; // mg/dL per U
}
