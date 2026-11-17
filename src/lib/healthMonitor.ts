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
import SugarReading, {
  getReadingFromNightscout,
} from "../models/types/sugarReading";
import { getHourDiff, getMinuteDiff } from "./timing";
import { MathUtil, round } from "./util";
import RemoteReadings from "./remote/readings";
import { getBGVelocities } from "./readingsUtil";
import { populateFastingVelocitiesCache } from "./basal";
import Glucose from "../models/events/glucose";
import { HealthMonitorStore } from "../storage/healthMonitorStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { PrivateStore } from "../storage/privateStore";
import { BasalStore } from "../storage/basalStore";
import { BackendStore } from "../storage/backendStore";
import type { RescueVariant } from "../models/types/rescueVariant";
import { InsulinExpirationManager } from "../managers/expirationManager";
import Insulin from "../models/events/insulin";
import Meal from "../models/events/meal";
import type { InsulinVariant } from "../models/types/insulinVariant";
import RemoteTreatments from "./remote/treatments";

/** Readings history is backfilled with a full fetch once per app session. */
let historyBackfilled = false;

/**
 * Poll nightscout to fill the reading caches.
 *
 * `readingsCache` gets exactly the newest `readingsCacheSize` readings of the
 * fetch (the short horizon every predictor/ISF consumer was built on).
 * `readingsHistory` merges each fetch into a rolling `readingsHistoryHours`
 * window for display only.
 */
export async function populateReadingCache() {
  const minutesPerReading = BackendStore.minutesPerReading.value || 5;
  const backfill = !historyBackfilled;
  const count = backfill
    ? Math.max(
        HealthMonitorStore.readingsCacheSize,
        Math.ceil(
          (HealthMonitorStore.readingsHistoryHours * 60) / minutesPerReading,
        ),
      )
    : HealthMonitorStore.readingsCacheSize;
  const rawReadings = await RemoteReadings.getLatestReadings(count);
  if (!Array.isArray(rawReadings) || rawReadings.length === 0) return null;

  const convertedRawReadings: SugarReading[] = rawReadings.map(
    getReadingFromNightscout,
  );
  const readings = convertedRawReadings.filter(
    (a) => a.sugar <= 400 && a.sugar >= 0,
  ); // Refuse to sync anything larger than 400 or less than 0
  if (backfill) historyBackfilled = true;

  HealthMonitorStore.readingsHistory.value = mergeReadingHistory(
    HealthMonitorStore.readingsHistory.value,
    readings,
  );
  const recent = readings.slice(0, HealthMonitorStore.readingsCacheSize);
  HealthMonitorStore.readingsCache.value = recent;
  HealthMonitorStore.currentBG.value = recent[0].sugar;
  refreshR1Context();
  refreshFingersticks();
  return recent;
}

/**
 * Refresh fingersticks over the history window from Nightscout. Best-effort:
 * on failure the previous list stays. At most one request in flight.
 */
let fingersticksInFlight: Promise<void> | null = null;
export function refreshFingersticks(): Promise<void> {
  if (fingersticksInFlight) return fingersticksInFlight;
  fingersticksInFlight = (async () => {
    try {
      const now = new Date();
      const start = new Date(
        now.getTime() - HealthMonitorStore.readingsHistoryHours * 3_600_000,
      );
      const raw = await RemoteReadings.getMeterReadings(start, now);
      const sticks = raw
        .filter((r: { mbg?: number }) => r && r.mbg != null)
        .map(getReadingFromNightscout)
        .filter(
          (r: SugarReading) =>
            Number.isFinite(r.sugar) &&
            r.sugar > 0 &&
            !isNaN(r.timestamp.getTime()),
        )
        .sort(
          (a: SugarReading, b: SugarReading) =>
            a.timestamp.getTime() - b.timestamp.getTime(),
        );
      HealthMonitorStore.fingersticks.value = sticks;
    } catch (e) {
      if (PrivateStore.debugLogs.value)
        console.warn("fingerstick refresh failed", e);
    } finally {
      fingersticksInFlight = null;
    }
  })();
  return fingersticksInFlight;
}

/** Union by timestamp (fresh readings win), trimmed to the history window, newest first. */
function mergeReadingHistory(
  history: SugarReading[],
  fresh: SugarReading[],
): SugarReading[] {
  const cutoff =
    Date.now() - HealthMonitorStore.readingsHistoryHours * 3_600_000;
  const byTime = new Map<number, SugarReading>();
  for (const r of history) byTime.set(r.timestamp.getTime(), r);
  for (const r of fresh) byTime.set(r.timestamp.getTime(), r);
  return Array.from(byTime.values())
    .filter((r) => r.timestamp.getTime() >= cutoff && Number.isFinite(r.sugar))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
/**
 * Refresh the r1 context (recent meals + basal times) from Nightscout.
 * Best-effort: on failure the previous values stay, and the r1 features
 * degrade gracefully (carbs/protein = 0, t_since_basal = 24 h).
 *
 * The 48 h window (wider than the app's usual 3 h meal window) is what the
 * r1 feature builder needs: seq ch6 reads the meal immediately preceding
 * each slot's 60-min window, and the model was trained on full meal
 * history. A fast longer than 48 h is the only case where that lookback
 * meal can be missing.
 */
let r1ContextInFlight: Promise<void> | null = null;
export function refreshR1Context(): Promise<void> {
  if (r1ContextInFlight) return r1ContextInFlight;
  r1ContextInFlight = (async () => {
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 48 * 3_600_000);
      const treatments = await RemoteTreatments.getTreatments(start, now);
      const meals: Meal[] = [];
      const basalTimes: number[] = [];
      for (const t of treatments ?? []) {
        if (t.eventType === "Meal") {
          const meal = new Meal(new Date(t.created_at));
          meal.carbsOffset = t.carbs ?? 0;
          meal.proteinOffset = t.protein ?? 0;
          meals.push(meal);
        } else if (t.eventType === "Basal Insulin") {
          basalTimes.push(new Date(t.created_at).getTime());
        }
      }
      meals.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      basalTimes.sort((a, b) => a - b);
      HealthMonitorStore.recentMeals.value = meals.slice(-32);
      HealthMonitorStore.recentBasalTimes.value = basalTimes.slice(-32);
    } catch (e) {
      if (PrivateStore.debugLogs.value)
        console.warn("r1 context refresh failed", e);
    } finally {
      r1ContextInFlight = null;
    }
  })();
  return r1ContextInFlight;
}
export function getLatestReading(): SugarReading | null {
  const readingsCache = HealthMonitorStore.readingsCache.value;
  if (readingsCache.length === 0) return null;
  let latestReading: SugarReading = readingsCache[0];
  for (const reading of readingsCache) {
    if (reading.timestamp.getTime() > latestReading.timestamp.getTime())
      latestReading = reading;
  }
  return latestReading;
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
  const list = readings ?? HealthMonitorStore.readingsCache.value;
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
  const pointsToCritical =
    HealthMonitorStore.currentBG.value - PreferencesStore.dangerBG.value;
  return round(pointsToCritical / pointsPerMinute, 0);
}

// Rescue Glucose
export function setLastRescue(
  amount: number,
  variant: RescueVariant,
  timestamp = new Date(),
) {
  const glucose = new Glucose(amount, timestamp, variant);
  HealthMonitorStore.lastRescues.value = [
    glucose,
    ...HealthMonitorStore.lastRescues.value,
  ].slice(0, Math.max(0, HealthMonitorStore.numLastRescues));
}

export function getLastRescue(): Glucose | null {
  const lastRescues = HealthMonitorStore.lastRescues.value;
  if (lastRescues.length === 0) return null;
  return lastRescues[0];
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
  const basals = BasalStore.basalDoses.value;
  return basals[0];
}
export function getLatestBasalTimestamp() {
  const latestBasal = getLatestBasal();
  const lastBasalTimestamp = latestBasal ? latestBasal.timestamp : new Date();
  return lastBasalTimestamp;
}

// Insulin Bolus
export function addRecentBolus(
  units: number,
  variant: InsulinVariant,
  timestamp = new Date(),
) {
  HealthMonitorStore.recentBoluses.value = [
    new Insulin(units, timestamp, variant),
    ...HealthMonitorStore.recentBoluses.value,
  ].slice(0, HealthMonitorStore.numRecentBoluses);
}
export function getLatestBolus() {
  const recentBoluses = HealthMonitorStore.recentBoluses.value;
  if (recentBoluses.length === 0) return null;
  return recentBoluses
    .slice()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
}
export function getIOB(time = new Date()) {
  const onBoardInsulins = HealthMonitorStore.recentBoluses.value;
  return onBoardInsulins.reduce(
    (total, insulin) => total + insulin.iob(time),
    0,
  );
}
export function getEffectOnBoard(time = new Date()) {
  const onBoardInsulins = HealthMonitorStore.recentBoluses.value;
  return onBoardInsulins.reduce(
    (total, insulin) => total + insulin.iob(time) * insulin.variant.effect,
    0,
  );
}
export function getTimeSinceLastBolus() {
  const now = new Date();
  const latestBasal = getLatestBolus();
  const lastBasalTimestamp = latestBasal ? latestBasal.timestamp : now;
  return getHourDiff(now, lastBasalTimestamp);
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

    const latestBolus = getLatestBolus();
    if (currentBG > PreferencesStore.highBG.value && latestBolus === null) {
      HealthMonitorStore.statusCache.value = HealthMonitorStatus.High;
      return;
    }

    // If we need to take basal insulin
    if (basalIsDue()) {
      HealthMonitorStore.statusCache.value = HealthMonitorStatus.Basal;
      return;
    }

    if (InsulinExpirationManager.getExpired().length) {
      HealthMonitorStore.statusCache.value = HealthMonitorStatus.InsulinExpired;
      return;
    }
  }
}
