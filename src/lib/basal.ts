import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import { SessionManager } from "../managers/sessionManager";
import Glucose from "../models/events/glucose";
import Insulin from "../models/events/insulin";
import type Session from "../models/session";
import SugarReading, {
  getReadingFromNightscout,
} from "../models/types/sugarReading";
import type { DateRange } from "../models/types/types";
import Unit from "../models/unit";
import { BackendStore } from "../storage/backendStore";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PrivateStore } from "../storage/privateStore";
import { StreamStore } from "../storage/streamStore";
import { getBasalCorrection } from "./metabolism";
import { getBGVelocities } from "./readingsUtil";
import RemoteReadings from "./remote/readings";
import RemoteTreatments, {
  mealEventType,
  insulinEventType,
  glucoseEventType,
  basalEventType,
  activityEventType,
} from "./remote/treatments";
import { getTimestampFromOffset, timestampIsBetween } from "./timing";
import { convertDimensions, MathUtil, round } from "./util";

export async function isFastingState(timestamp: Date) {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;

  async function isPresent(eventType: string, minTime: number) {
    const timestampA = getTimestampFromOffset(timestamp, -minTime);
    const treatments = await RemoteTreatments.getTreatmentByType(
      eventType,
      timestampA,
      timestamp,
    );
    return treatments.length !== 0;
  }
  if (await isPresent(mealEventType, minTimeSinceMeal)) return false;
  if (await isPresent(insulinEventType, 7)) return false;
  if (await isPresent(glucoseEventType, 0.5)) return false;
  return true;
}

function getNonFastingWindows(
  treatments: any[],
  ignoreGlucose: boolean = false,
): DateRange[] {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;

  let nonFasting: DateRange[] = []; // A set of date pairs to describe when we are not fasting
  treatments.forEach((a: any) => {
    let hoursNonFasting: number | null = null;
    if (a.insulin && a.eventType !== basalEventType) hoursNonFasting = 7;
    switch (a.eventType) {
      case mealEventType:
        hoursNonFasting = minTimeSinceMeal;
        break;
      case insulinEventType:
        const variant = InsulinVariantManager.getVariant(a.notes);
        if (a.insulin) {
          const date = new Date();
          const insulin = new Insulin(a.insulin, date, variant);
          hoursNonFasting = insulin.duration;
        }
        break;
      case glucoseEventType:
        hoursNonFasting = ignoreGlucose
          ? null
          : RescueVariantManager.getVariant(a.notes).duration / 60; // Convert from minutes to hours
        break;
      case activityEventType:
        hoursNonFasting = a.duration ? a.duration / 60 : null;
        break;
    }
    if (hoursNonFasting !== null)
      nonFasting.push([
        a.timestamp,
        getTimestampFromOffset(a.timestamp, hoursNonFasting),
      ]);
  });
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
function getFastingVelocities(
  treatments: any[],
  readings: SugarReading[],
): number[] {
  let nonFasting = getNonFastingWindows(treatments); // A set of date pairs to describe when we are not fasting

  if (PrivateStore.debugLogs.value) console.log(nonFasting);
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
function getFastingGlucoses(treatments: any[]): Glucose[] {
  let nonFasting = getNonFastingWindows(treatments, true);
  let glucoses: Glucose[] = [];
  treatments.forEach((a: any) => {
    if (a.eventType === glucoseEventType) {
      glucoses.push(
        new Glucose(
          a.carbs,
          new Date(a.created_at),
          RescueVariantManager.getVariant(a.variant),
        ),
      );
    }
  });
  glucoses = glucoses.filter((g) => isFasting(g.timestamp, nonFasting));
  return glucoses;
}

export async function populateFastingVelocitiesCache() {
  const hours = InsulinVariantManager.getBasalVariant().duration;
  const now = new Date();
  const timestampA = getTimestampFromOffset(now, -hours);
  const timestampB = now;
  const treatments: any[] = await RemoteTreatments.getTreatments(
    timestampA,
    now,
  );
  const rawReadings = await RemoteReadings.getReadings(timestampA, timestampB);
  const readings = rawReadings.map((a: any) => getReadingFromNightscout(a));
  BasalStore.fastingVelocitiesCache.value = getFastingVelocities(
    treatments,
    readings,
  );
  BasalStore.fastingGlucosesCache.value = getFastingGlucoses(treatments);
  if (PrivateStore.debugLogs.value)
    console.log(BasalStore.fastingGlucosesCache.value);
}

export function getFastingVelocity() {
  const fastingVelocities = BasalStore.fastingVelocitiesCache.value;
  if (fastingVelocities.length === 0) return 0; // No data — assume flat
  const averageVelocity = MathUtil.mean(fastingVelocities);

  // We account for correction glucose that had to be taken while fasting
  const hours = getFastingLength();
  const fastingGlucoses = BasalStore.fastingGlucosesCache.value;
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
export function getFastingLength() {
  const velocities = BasalStore.fastingVelocitiesCache.value;
  const minutesPerReading = BackendStore.cgmDelay.value;
  const minutes = velocities.length * minutesPerReading;
  const hours = minutes / 60;
  return hours;
}

export function getDailyBasal() {
  const doses: Insulin[] = BasalStore.basalDoses.value;
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
  const basals = StreamStore.stream.value.basals;

  const insulin = basals[basals.length - shotsPerDay];
  return insulin ? insulin.value : 0;
}
function getShotsSinceChange() {}
export function dosingChangeComplete() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const minDays = InsulinVariantManager.getBasalVariant().duration / 24;

  const minShots = shotsPerDay * minDays;
  return getShotsSinceChange() >= minShots;
}
function getRecommendationIndex() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const shotsSinceChange = BasalStore.shotsSinceLastChange.value;
  return shotsSinceChange % shotsPerDay;
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
  sessions;
  minBasalDiffPerDay;
  requireNonNegativeS;
  throw new Error(`Unsupported`);
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
