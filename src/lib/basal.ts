import Insulin from "../models/events/insulin";
import SugarReading, {
  getReadingFromNightscout,
} from "../models/types/sugarReading";
import Unit from "../models/unit";
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
} from "./remote/treatments";
import { getTimestampFromOffset, timestampIsBetween } from "./timing";
import { convertDimensions, MathUtil, round } from "./util";

export async function isFasting(timestamp: Date) {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;
  const minTimeSinceBolus = BasalStore.minTimeSinceBolus.value;
  const minTimeSinceDextrose = BasalStore.minTimeSinceDextrose.value / 60; // Minutes -> Hours

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
  if (await isPresent(insulinEventType, minTimeSinceBolus)) return false;
  if (await isPresent(glucoseEventType, minTimeSinceDextrose)) return false;
  return true;
}

function getFastingVelocities(
  treatments: any[],
  readings: SugarReading[]
): number[] {
  const minTimeSinceMeal = BasalStore.minTimeSinceMeal.value;
  const minTimeSinceBolus = BasalStore.minTimeSinceBolus.value;
  const minTimeSinceDextrose = BasalStore.minTimeSinceDextrose.value / 60; // Minutes -> Hours

  let nonFasting: [Date, Date][] = []; // A set of date pairs to describe when we are not fasting
  treatments.forEach((a: any) => {
    let hoursNonFasting: number | null = null;
    if (a.insulin && a.eventType !== basalEventType)
      hoursNonFasting = minTimeSinceBolus;
    switch (a.eventType) {
      case mealEventType:
        hoursNonFasting = minTimeSinceMeal;
        break;
      case insulinEventType:
        hoursNonFasting = minTimeSinceBolus;
        break;
      case glucoseEventType:
        hoursNonFasting = minTimeSinceDextrose;
        break;
    }
    if (hoursNonFasting !== null)
      nonFasting.push([
        a.timestamp,
        getTimestampFromOffset(a.timestamp, hoursNonFasting),
      ]);
  });

  let velocities: number[] = [];
  const isFasting = (timestamp: Date): boolean => {
    for (let datePair of nonFasting) {
      const timestampA = datePair[0];
      const timestampB = datePair[1];
      if (timestampIsBetween(timestamp, timestampA, timestampB)) return false;
    }
    return true;
  };
  let currentSet: SugarReading[] = [];
  readings.forEach((reading: SugarReading, index: number) => {
    const fasting = isFasting(reading.timestamp);
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
}

export function getFastingVelocity() {
  const fastingVelocities = BasalStore.fastingVelocitiesCache.value;
  const averageVelocities = MathUtil.mean(fastingVelocities);
  return averageVelocities;
}

export function markBasal(units: number) {
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
  const now = new Date();
  const doses: Insulin[] = BasalStore.basalDoses.value;
  const newBasalDoses = [new Insulin(units, now), ...doses];
  newBasalDoses.slice(0, days * shotsPerDay);
  BasalStore.basalDoses.value = newBasalDoses;

  // Mark in nightscout
  RemoteTreatments.markBasal(units, now);
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
