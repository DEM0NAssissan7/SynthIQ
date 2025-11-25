import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { RescueVariantManager } from "../managers/rescueVariantManager";
import Glucose from "../models/events/glucose";
import Insulin from "../models/events/insulin";
import { InsulinVariant } from "../models/types/insulinVariant";
import SugarReading, {
  getReadingFromNightscout,
} from "../models/types/sugarReading";
import Unit from "../models/unit";
import { BackendStore } from "../storage/backendStore";
import { BasalStore } from "../storage/basalStore";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
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
      timestamp
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
  ignoreGlucose: boolean = false
): [Date, Date][] {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;

  let nonFasting: [Date, Date][] = []; // A set of date pairs to describe when we are not fasting
  treatments.forEach((a: any) => {
    let hoursNonFasting: number | null = null;
    if (a.insulin && a.eventType !== basalEventType) hoursNonFasting = 7;
    switch (a.eventType) {
      case mealEventType:
        hoursNonFasting = minTimeSinceMeal;
        break;
      case insulinEventType:
        hoursNonFasting = InsulinVariantManager.getVariant(a.notes).duration;
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
  return nonFasting;
}
function isFasting(timestamp: Date, nonFasting: [Date, Date][]): boolean {
  for (let datePair of nonFasting) {
    const timestampA = datePair[0];
    const timestampB = datePair[1];
    if (timestampIsBetween(timestamp, timestampA, timestampB)) return false;
  }
  return true;
}
function getFastingVelocities(
  treatments: any[],
  readings: SugarReading[]
): number[] {
  let nonFasting = getNonFastingWindows(treatments); // A set of date pairs to describe when we are not fasting

  console.log(nonFasting);
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
          RescueVariantManager.getVariant(a.variant)
        )
      );
    }
  });
  glucoses = glucoses.filter((g) => isFasting(g.timestamp, nonFasting));
  return glucoses;
}

export async function populateFastingVelocitiesCache() {
  const days = BasalStore.basalEffectDays.value;
  const hours = days * convertDimensions(Unit.Time.Day, Unit.Time.Hour);
  const now = new Date();
  const timestampA = getTimestampFromOffset(now, -hours);
  const timestampB = now;
  const treatments: any[] = await RemoteTreatments.getTreatments(
    timestampA,
    now
  );
  const rawReadings = await RemoteReadings.getReadings(timestampA, timestampB);
  const readings = rawReadings.map((a: any) => getReadingFromNightscout(a));
  BasalStore.fastingVelocitiesCache.value = getFastingVelocities(
    treatments,
    readings
  );
  BasalStore.fastingGlucosesCache.value = getFastingGlucoses(treatments);
  console.log(BasalStore.fastingGlucosesCache.value);
}

export function getFastingVelocity() {
  const fastingVelocities = BasalStore.fastingVelocitiesCache.value;
  const averageVelocity = MathUtil.mean(fastingVelocities);

  // We account for correction glucose that had to be taken while fasting
  const hours = getFastingLength();
  const fastingGlucoses = BasalStore.fastingGlucosesCache.value;
  let totalFastingGlucoseEffect = 0;
  fastingGlucoses.forEach(
    (g) => (totalFastingGlucoseEffect += (g.value ?? 0) * g.variant.effect)
  );
  console.log(
    averageVelocity,
    totalFastingGlucoseEffect / hours,
    fastingGlucoses
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

export const basalInsulinVariant = new InsulinVariant(
  "Basal",
  24 * BasalStore.basalEffectDays.value,
  BasalStore.basalEffect.value
);
export function markBasal(units: number, timestamp: Date) {
  const days = BasalStore.basalEffectDays.value;
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;

  // Detect if user has made changes to dosing pattern
  const lastShot = getLastShot();
  let shotsSinceChange = BasalStore.shotsSinceLastChange.value;
  if (lastShot && Math.abs(lastShot - units) > 0.01) {
    shotsSinceChange = getRecommendationIndex();
  }
  BasalStore.shotsSinceLastChange.value = shotsSinceChange + 1;

  // Add dose to the list of doses
  const doses: Insulin[] = BasalStore.basalDoses.value;
  const newBasalDoses = [
    new Insulin(units, timestamp, basalInsulinVariant),
    ...doses,
  ];
  BasalStore.basalDoses.value = newBasalDoses.slice(0, days * shotsPerDay);

  // Mark in nightscout
  RemoteTreatments.markBasal(units, timestamp);
}

export function getDailyBasal() {
  const doses: Insulin[] = BasalStore.basalDoses.value;
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
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
  const basals = BasalStore.basalDoses.value;

  const insulin = basals[shotsPerDay - 1];
  return insulin ? insulin.value : 0;
}
export function dosingChangeComplete() {
  const shotsSinceChange = BasalStore.shotsSinceLastChange.value;
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const minDays = BasalStore.basalEffectDays.value;

  const minShots = shotsPerDay * minDays;
  return shotsSinceChange >= minShots;
}
function getRecommendationIndex() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const shotsSinceChange = BasalStore.shotsSinceLastChange.value;
  return shotsSinceChange % shotsPerDay;
}
export function setLastRecommendation(units: number) {
  // Units per day, not per shot
  const index = getRecommendationIndex();

  let recommendations = BasalStore.lastRecommendation.value;
  recommendations[index] = units;
  BasalStore.lastRecommendation.write();
}
export function getLastRecommendation() {
  const index = getRecommendationIndex();

  return BasalStore.lastRecommendation.value[index];
}
export function getRecommendedBasal(): number {
  const lastShot = getLastShot();
  if (dosingChangeComplete()) {
    const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
    const correction = round(getBasalCorrection(getFastingVelocity()), 0);

    const shotCorrection = round(correction / shotsPerDay, 1);
    const newBasal = lastShot + shotCorrection;

    setLastRecommendation(newBasal);
    return lastShot + shotCorrection;
  } else {
    return getLastRecommendation() > 0 ? getLastRecommendation() : lastShot;
  }
}
