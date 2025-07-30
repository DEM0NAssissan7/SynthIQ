import {
  getReadingFromNightscout,
  type SugarReading,
} from "../models/types/sugarReading";
import Unit from "../models/unit";
import basalStore from "../storage/basalStore";
import healthMonitorStore from "../storage/healthMonitorStore";
import { getBGVelocities } from "./readingsUtil";
import RemoteReadings from "./remote/readings";
import RemoteTreatments, {
  mealEventType,
  insulinEventType,
  glucoseEventType,
} from "./remote/treatments";
import { getTimestampFromOffset, timestampIsBetween } from "./timing";
import { convertDimensions, MathUtil } from "./util";

export async function isFasting(timestamp: Date) {
  const minTimeSinceMeal = basalStore.get("minTimeSinceMeal");
  const minTimeSinceBolus = basalStore.get("minTimeSinceBolus");
  const minTimeSinceDextrose = basalStore.get("minTimeSinceDextrose") / 60; // Minutes -> Hours

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
  const minTimeSinceMeal = basalStore.get("minTimeSinceMeal");
  const minTimeSinceBolus = basalStore.get("minTimeSinceBolus");
  const minTimeSinceDextrose = basalStore.get("minTimeSinceDextrose") / 60; // Minutes -> Hours

  let nonFasting: [Date, Date][] = []; // A set of date pairs to describe when we are not fasting
  treatments.forEach((a: any) => {
    let hoursNonFasting: number | null = null;
    if (a.insulin) hoursNonFasting = minTimeSinceBolus;
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
  const days = basalStore.get("basalEffectDays");
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
  basalStore.set(
    "fastingVelocitiesCache",
    getFastingVelocities(treatments, readings)
  );
}

export function getFastingVelocity() {
  const fastingVelocities = basalStore.get("fastingVelocitiesCache");
  const averageVelocities = MathUtil.mean(fastingVelocities);
  return averageVelocities;
}

export function markBasal(units: number) {
  const days = basalStore.get("basalEffectDays");
  const shotsPerDay = healthMonitorStore.get("basalShotsPerDay");

  // Add dose to the list of doses
  let doses: number[] = basalStore.get("basalDoses");
  doses.splice(0, 0, units);
  basalStore.set("basalDoses", doses.slice(0, days * shotsPerDay));

  // Set last basal timestamp internally
  const timestamp = new Date();
  basalStore.set("lastBasalTimestamp", timestamp);

  // Mark in nightscout
  RemoteTreatments.markBasal(units, timestamp);
}

export function getBasals() {
  return basalStore.get("basalDoses") as number[];
}
export function getLastBasalTimestamp() {
  return basalStore.get("lastBasalTimestamp") as Date;
}

export function getDailyBasal() {
  const doses: number[] = basalStore.get("basalDoses");
  const shotsPerDay = healthMonitorStore.get("basalShotsPerDay");
  let sum = 0;
  let days = 0;
  for (let i = 0; i + shotsPerDay <= doses.length; i += shotsPerDay) {
    let totalDose = 0;
    for (let j = i; j < i + shotsPerDay; j++) {
      totalDose += doses[j];
    }
    sum += totalDose;
    days++;
  }
  return sum / days;
}
export function getDailyBasalPerShot() {
  const shotsPerDay = healthMonitorStore.get("basalShotsPerDay");
  return getDailyBasal() / shotsPerDay;
}
