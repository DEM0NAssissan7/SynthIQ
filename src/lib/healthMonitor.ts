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
import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import SugarReading, {
  getReadingFromNightscout,
} from "../models/types/sugarReading";
import { getHourDiff, getMinuteDiff } from "./timing";
import { MathUtil, round } from "./util";
import RemoteReadings from "./remote/readings";
import { getBGVelocities } from "./readingsUtil";
import { isFastingState, populateFastingVelocitiesCache } from "./basal";
import Glucose from "../models/events/glucose";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { BasalStore } from "../storage/basalStore";
import type { RescueVariant } from "../models/types/rescueVariant";

/** Poll nightscout to fill the reading cache */
export async function populateReadingCache() {
  const readingsCacheSize = HealthMonitorStore.readingsCacheSize.value;
  const rawReadings = await RemoteReadings.getLatestReadings(readingsCacheSize);
  if (rawReadings) {
    let readings = rawReadings.map((r: any) =>
      getReadingFromNightscout(r)
    ) as SugarReading[];
    HealthMonitorStore.readingsCache.value = readings;
    HealthMonitorStore.currentBG.value = readings[0].sugar;
    return readings;
  }
  return null;
}

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the CGM readings
 */
export function getBGVelocity() {
  const readings = HealthMonitorStore.readingsCache.value;
  const velocities = getBGVelocities(readings);
  // We give the median of all the velocities to smooth out jumps
  return MathUtil.mean(velocities);
}
/**
 * Gives a time (in minutes) that the user will end up at or below critical blood sugar
 */
export function timeToCritical() {
  const pointsPerMinute = -getBGVelocity() / 60;
  if (pointsPerMinute <= 0) return Infinity;
  const pointsToCritical =
    HealthMonitorStore.currentBG.value - PreferencesStore.dangerBG.value;
  return round(pointsToCritical / pointsPerMinute, 0);
}

// Rescue Glucose
export function markGlucose(
  grams: number,
  variant: RescueVariant,
  timestamp = new Date()
) {
  HealthMonitorStore.lastRescue.value = new Glucose(grams, timestamp, variant);
}

export function getLastRescueMinutes() {
  const minuteDiff = round(
    getMinuteDiff(new Date(), HealthMonitorStore.lastRescue.value.timestamp),
    0
  );
  return minuteDiff;
}
export function getLastRescueCaps() {
  return HealthMonitorStore.lastRescue.value.value;
}

function getLatestBasal() {
  const basals = BasalStore.basalDoses.value;
  return basals[0];
}
export function getLatestBasalTimestamp() {
  const latestBasal = getLatestBasal();
  const lastBasalTimestamp = latestBasal ? latestBasal.timestamp : new Date();
  return lastBasalTimestamp;
}

// Basal
export function getTimeSinceLastBasal() {
  const now = new Date();
  const latestBasal = getLatestBasal();
  const lastBasalTimestamp = latestBasal ? latestBasal.timestamp : now;
  return getHourDiff(now, lastBasalTimestamp);
}
export function basalIsDue() {
  const shotsPerDay = HealthMonitorStore.basalShotsPerDay.value;
  const interval = 24 / shotsPerDay;
  const timeSinceLastBasal = getTimeSinceLastBasal();

  // Rule 1: If it's been too long since last shot
  if (timeSinceLastBasal >= interval) {
    return true;
  }

  // We infer the following times being equally spaced. For example, if two shots, our first shot is at 8, and the second is at 20. If three shots, it's 8, 16, 24

  // If it's been longer than the allowed interval since the last basal, or if the current time has passed the scheduled basal shot time and the shot hasn't been taken yet, basal is due
  // Rule 2: Based on scheduled times
  const firstShotHour = HealthMonitorStore.basalShotTime.value; // 8 => 8:00 AM, 16 => 4:00 PM
  const now = new Date();
  const nowTime = now.getTime();
  const lastBasal = getLatestBasalTimestamp();

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
    const currentBG = HealthMonitorStore.currentBG.value;

    // Assume things are nominal
    HealthMonitorStore.statusCache.value = HealthMonitorStatus.Nominal;

    // If the user hasn't already taken glucose
    const timeBetweenShots = HealthMonitorStore.timeBetweenShots.value;
    if (getLastRescueMinutes() >= timeBetweenShots) {
      // Check critical time
      const criticalTime = timeToCritical();
      if (criticalTime <= 20) {
        HealthMonitorStore.statusCache.value = HealthMonitorStatus.Falling;
        return;
      }

      if (currentBG < PreferencesStore.lowBG.value) {
        HealthMonitorStore.statusCache.value = HealthMonitorStatus.Low;
        return;
      }
    }

    const fasting = await isFastingState(new Date());
    if (currentBG > PreferencesStore.highBG.value && fasting) {
      HealthMonitorStore.statusCache.value = HealthMonitorStatus.High;
      return;
    }

    // If we need to take basal insulin
    if (basalIsDue()) {
      HealthMonitorStore.statusCache.value = HealthMonitorStatus.Basal;
      return;
    }
  }
}
export async function smartMonitor(navigate: NavigateFunction) {
  const status = HealthMonitorStore.statusCache.value;
  if (status !== null) {
    switch (status) {
      case HealthMonitorStatus.Nominal:
        break;
      case HealthMonitorStatus.Falling:
      case HealthMonitorStatus.Low:
        navigate("/rescue");
        break;
      case HealthMonitorStatus.High:
        navigate("/insulin");
        break;
      default:
        break;
    }
  }
}
