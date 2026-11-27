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

import HealthMonitorStatus from "../models/types/healthMonitorStatus";
import type SugarReading from "../models/types/sugarReading";
import { getHourDiff, getMinuteDiff, getTimestampFromOffset } from "./timing";
import { MathUtil, round } from "./util";
import { getBGVelocities } from "./readingsUtil";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { InsulinExpirationManager } from "../managers/expirationManager";
import { StreamManager } from "../managers/streamManager";
import type { Stream } from "../models/stream";
import { ReadingType } from "../models/types/sugarReading";

/**
 * Everything here is derived from the stream. Readings and treatments reach
 * the stream through StreamManager.populateFromRemote (Nightscout) and the
 * StreamManager.mark* functions (logged in the app).
 */

// Readings
/** Number of newest CGM readings every predictor/ISF consumer is built on */
export const numLatestReadings = 36;
/** Hours of CGM readings shown on the hub graph */
export const readingsHistoryHours = 24;
/** Hours of treatments handed to the r1 predictor as context */
export const r1ContextHours = 48;
/** Number of each treatment type handed to the r1 predictor as context */
export const r1ContextSize = 32;
/** Number of recent boluses / rescues used for IOB and the forecast */
export const numRecentTreatments = 16;

/** CGM readings Nightscout would serve: never above 400 or below 0 */
function isPlausible(reading: SugarReading) {
  return reading.sugar <= 400 && reading.sugar >= 0;
}

/**
 * The newest `readingsCacheSize` CGM readings, newest first: the short
 * horizon every predictor/ISF consumer was built on. Calibrations
 * (fingersticks, entered BGs) are excluded, as the CGM feed never had them.
 */
export function getLatestReadings(
  stream: Stream = StreamManager.stream,
): SugarReading[] {
  return stream.snapshot.latest(numLatestReadings, false).filter(isPlausible);
}
/** Up to `readingsHistoryHours` of CGM readings before `now`, newest first. For display. */
export function getReadingsHistory(
  stream: Stream = StreamManager.stream,
  now = new Date(),
): SugarReading[] {
  const start = getTimestampFromOffset(now, -readingsHistoryHours);
  return stream.snapshot
    .view(start, now)
    .readings.filter((r) => r.type === ReadingType.Normal && isPlausible(r))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
/** Measured blood sugars (meter calibrations from Nightscout and manual entries) over the history window, oldest first */
export function getFingersticks(
  stream: Stream = StreamManager.stream,
  now = new Date(),
): SugarReading[] {
  const start = getTimestampFromOffset(now, -readingsHistoryHours);
  return stream.snapshot
    .view(start, now)
    .readings.filter((r) => r.type !== ReadingType.Normal)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
export function getLatestReading(
  stream: Stream = StreamManager.stream,
): SugarReading | null {
  return getLatestReadings(stream)[0] ?? null;
}
export function getCurrentBG(
  stream: Stream = StreamManager.stream,
): number | null {
  return getLatestReading(stream)?.sugar ?? null;
}

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the CGM readings
 */
export function getBGVelocity(
  readingsOrCount?: SugarReading[] | number,
  maybeCount: number = 3,
) {
  let readings: SugarReading[] | undefined;
  let count = 3;
  if (Array.isArray(readingsOrCount)) {
    readings = readingsOrCount;
    count = maybeCount;
  } else if (typeof readingsOrCount === "number") {
    count = readingsOrCount;
  }
  const list = readings ?? getLatestReadings();
  const velocities = getBGVelocities(list);
  if (velocities.length === 0) return 0;
  // We give the mean of all the velocities to smooth out jumps
  return MathUtil.mean(velocities.slice(0, count));
}
/**
 * Gives a time (in minutes) that the user will end up at or below critical blood sugar
 */
export function timeToCritical() {
  const pointsPerMinute = -getBGVelocity() / 60;
  if (pointsPerMinute <= 0) return Infinity;
  const currentBG = getCurrentBG();
  if (currentBG === null) return Infinity;
  const pointsToCritical = currentBG - PreferencesStore.dangerBG.value;
  return round(pointsToCritical / pointsPerMinute, 0);
}

// Rescue Glucose
/** The newest `numRecentTreatments` rescues, newest first */
export function getRecentRescues(stream: Stream = StreamManager.stream) {
  return stream.rescues.slice(-numRecentTreatments).reverse();
}
export function getLastRescue() {
  return getRecentRescues()[0] ?? null;
}
export function getLastRescueMinutes() {
  const lastRescue = getLastRescue();
  if (!lastRescue) return Infinity;
  const minuteDiff = round(getMinuteDiff(new Date(), lastRescue.timestamp), 0);
  return minuteDiff;
}
export function getLastRescueCaps() {
  const lastRescue = getLastRescue();
  if (!lastRescue) return 0;
  return lastRescue.value;
}

function getLatestBasal() {
  const basals = StreamManager.stream.basals;
  return basals[basals.length - 1] ?? null;
}
export function getLatestBasalTimestamp() {
  const latestBasal = getLatestBasal();
  const lastBasalTimestamp = latestBasal ? latestBasal.timestamp : new Date();
  return lastBasalTimestamp;
}

// Insulin Bolus
/** The newest `numRecentTreatments` boluses (everything but basal), newest first */
export function getRecentBoluses(stream: Stream = StreamManager.stream) {
  return stream.insulins.slice(-numRecentTreatments).reverse();
}
export function getLatestBolus() {
  return getRecentBoluses()[0] ?? null;
}
export function getIOB(time = new Date()) {
  return getRecentBoluses().reduce(
    (total, insulin) => total + insulin.iob(time),
    0,
  );
}
export function getEffectOnBoard(time = new Date()) {
  return getRecentBoluses().reduce(
    (total, insulin) => total + insulin.iob(time) * insulin.variant.effect,
    0,
  );
}
export function getTimeSinceLastBolus() {
  const now = new Date();
  const latestBolus = getLatestBolus();
  const lastBolusTimestamp = latestBolus ? latestBolus.timestamp : now;
  return getHourDiff(now, lastBolusTimestamp);
}

// r1 context
/** Meals and basal times over the last `r1ContextHours`, oldest first, as the r1 feature builder expects */
export function getR1Context(
  stream: Stream = StreamManager.stream,
  now = new Date(),
) {
  const window = stream.view(getTimestampFromOffset(now, -r1ContextHours), now);
  return {
    meals: window.meals.slice(-r1ContextSize),
    basalTimes: window.basals
      .slice(-r1ContextSize)
      .map((b) => b.timestamp.getTime()),
  };
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

/** The user's current status, from the stream as it stands */
export function getHealthMonitorStatus(): HealthMonitorStatus {
  const currentBG = getCurrentBG();
  if (currentBG === null) return HealthMonitorStatus.Nominal; // No CGM data

  // If the user hasn't already taken glucose
  const timeBetweenShots = HealthMonitorStore.timeBetweenShots.value;
  if (getLastRescueMinutes() >= timeBetweenShots) {
    // Check critical time
    const criticalTime = timeToCritical();
    if (criticalTime <= 20) return HealthMonitorStatus.Falling;
    if (currentBG < PreferencesStore.lowBG.value)
      return HealthMonitorStatus.Low;
  }

  const latestBolus = getLatestBolus();
  if (currentBG > PreferencesStore.highBG.value && latestBolus === null)
    return HealthMonitorStatus.High;

  // If we need to take basal insulin
  if (basalIsDue()) return HealthMonitorStatus.Basal;

  if (InsulinExpirationManager.getExpired().length)
    return HealthMonitorStatus.InsulinExpired;

  return HealthMonitorStatus.Nominal;
}
