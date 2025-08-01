/** This file is the user's best friend!
 *
 * This file contains the functions that silently watch the user's known vital signs,
 * and it will engage the user with the correct page depending on his current conditions
 *
 * For example, if the user's BG is dropping quickly, it will bring the user to the glucose page,
 * and it will brief user on the problem, saying "hey your sugar is dropping fast and you will enter
 * hypo in X minutes, you should take Y amount of glucose to not die" or something like that
 *
 * If sugar is below the 'alert' threshold, it automatically opens and gives suggestions based on current glycemic patterns
 *
 * If the user's blood sugar is persistently high, the app will automatically open
 * the insulin page and tell the user what's going on. For example, it might say "you've been above X
 *  mg/dL for Y hours. You should probably take Z units of insulin."
 *
 */

import type { NavigateFunction } from "react-router";
import Glucose from "../models/events/glucose";
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import {
  getReadingFromNightscout,
  type SugarReading,
} from "../models/types/sugarReading";
import healthMonitorStore from "../storage/healthMonitorStore";
import preferencesStore from "../storage/preferencesStore";
import { getHourDiff, getMinuteDiff } from "./timing";
import { MathUtil, round } from "./util";
import RemoteReadings from "./remote/readings";
import { getBGVelocities } from "./readingsUtil";
import basalStore from "../storage/basalStore";
import { populateFastingVelocitiesCache } from "./basal";

export let healthMonitorStatus = HealthMonitorStatus.Nominal;

/** Poll nightscout to fill the reading cache */
export async function populateReadingCache() {
  const readingsCacheSize = healthMonitorStore.get("readingsCacheSize");
  const rawReadings = await RemoteReadings.getLatestReadings(readingsCacheSize);
  if (rawReadings) {
    let readings = rawReadings.map((r: any) =>
      getReadingFromNightscout(r)
    ) as SugarReading[];
    healthMonitorStore.set("readingsCache", readings);
    healthMonitorStore.set("currentBG", readings[0].sugar);
    return readings;
  }
  return null;
}

/** Get readings */
function getReadings() {
  return healthMonitorStore.get("readingsCache") as SugarReading[];
}
export function getCurrentBG() {
  return healthMonitorStore.get("currentBG") as number;
}

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the CGM readings
 */
export function getBGVelocity() {
  const readings = getReadings();
  const velocities = getBGVelocities(readings);
  // We give the median of all the velocities to rule out insane jumps
  return MathUtil.median(velocities);
}
/**
 * Gives a time (in minutes) that the user will end up at or below critical blood sugar
 */
export function timeToCritical() {
  const pointsPerMinute = -getBGVelocity() / 60;
  if (pointsPerMinute <= 0) return Infinity;
  const currentBG = getCurrentBG();
  const dangerBG = preferencesStore.get("dangerBG");
  const pointsToCritical = currentBG - dangerBG;
  return round(pointsToCritical / pointsPerMinute, 0);
}

// Rescue Glucose
export function markGlucose(caps: number) {
  healthMonitorStore.set("lastRescue", new Glucose(new Date(), caps));
}
function getLastRescue() {
  return healthMonitorStore.get("lastRescue");
}

export function getLastRescueMinutes() {
  const minuteDiff = round(
    getMinuteDiff(new Date(), getLastRescue().timestamp),
    0
  );
  return minuteDiff;
}
export function getLastRescueCaps() {
  return getLastRescue().caps;
}

// Basal
export function getTimeSinceLastBasal() {
  const lastBasalTimestamp = basalStore.get("lastBasalTimestamp");
  return getHourDiff(new Date(), lastBasalTimestamp);
}
export function basalIsDue() {
  const shotsPerDay = healthMonitorStore.get("basalShotsPerDay");
  const interval = 24 / shotsPerDay;
  const timeSinceLastBasal = getTimeSinceLastBasal();

  // Rule 1: If it's been too long since last shot
  if (timeSinceLastBasal >= interval) {
    return true;
  }

  // We infer the following times being equally spaced. For example, if two shots, our first shot is at 8, and the second is at 20. If three shots, it's 8, 16, 24

  // If it's been longer than the allowed interval since the last basal, or if the current time has passed the scheduled basal shot time and the shot hasn't been taken yet, basal is due
  // Rule 2: Based on scheduled times
  const firstShotHour = healthMonitorStore.get("basalShotTime"); // 8 => 8:00 AM, 16 => 4:00 PM
  const now = new Date();
  const nowTime = now.getTime();
  const lastBasal = basalStore.get("lastBasalTimestamp");

  // Get the current hour we are targetting
  for (let i = 0; i < shotsPerDay; i++) {
    const hour = firstShotHour + i * interval; // Scheduled hour. We consider yesterday as well
    const scheduledTimestamp = new Date();
    scheduledTimestamp.setHours(hour % 24, 0, 0, 0);

    if (hour >= 24)
      scheduledTimestamp.setDate(scheduledTimestamp.getDate() + 1);
    if (scheduledTimestamp.getTime() <= nowTime) {
      if (lastBasal.getTime() < scheduledTimestamp.getTime()) return true;
      continue;
    }
  }

  return false;
}

export async function updateHealthMonitorStatus() {
  const readings: SugarReading[] | null = await populateReadingCache();
  populateFastingVelocitiesCache();
  if (readings) {
    // Assume things are nominal
    healthMonitorStatus = HealthMonitorStatus.Nominal;

    // Check critical time
    const criticalTime = timeToCritical();
    if (criticalTime <= 20) {
      healthMonitorStatus = HealthMonitorStatus.Falling;
      return healthMonitorStatus;
    }

    const currentBG = getCurrentBG();
    if (currentBG < preferencesStore.get("lowBG")) {
      healthMonitorStatus = HealthMonitorStatus.Low;
      return healthMonitorStatus;
    }

    if (currentBG > preferencesStore.get("highBG")) {
      healthMonitorStatus = HealthMonitorStatus.High;
      return healthMonitorStatus;
    }

    // If we need to take basal insulin
    if (basalIsDue()) {
      healthMonitorStatus = HealthMonitorStatus.Basal;
      return healthMonitorStatus;
    }

    // Final return
    return HealthMonitorStatus.Nominal;
  }
  return null;
}
export async function smartMonitor(navigate: NavigateFunction) {
  const status: HealthMonitorStatus | null = await updateHealthMonitorStatus();
  if (status !== null) {
    switch (status) {
      case HealthMonitorStatus.Nominal:
        break;
      case HealthMonitorStatus.Falling:
      case HealthMonitorStatus.Low:
        navigate("/rescue");
        break;
      case HealthMonitorStatus.High:
        navigate("/wizard");
        break;
      case HealthMonitorStatus.Basal:
        navigate("/basal");
        break;
      default:
        break;
    }
  }
}
