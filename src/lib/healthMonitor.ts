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

import {
  getReadingFromNightscout,
  type SugarReading,
} from "../models/types/sugarReading";
import healthMonitorStore from "../storage/healthMonitorStore";
import NightscoutManager from "./nightscoutManager";
import { getHourDiff } from "./timing";
import { MathUtil } from "./util";

/** Poll nightscout to fill the reading cache */
async function populateReadingCache() {
  const readingsCacheSize = healthMonitorStore.get("readingsCacheSize");
  const rawReadings = await NightscoutManager.getLatestReadings(
    readingsCacheSize
  );
  if (rawReadings) {
    let readings = rawReadings.map((r: any) =>
      getReadingFromNightscout(r)
    ) as SugarReading[];
    healthMonitorStore.set("readingsCache", readings);
    return readings;
  }
  return null;
}
// TODO: Remove
populateReadingCache;

/** Get readings */
function getReadings() {
  return healthMonitorStore.get("readingsCache");
}

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the CGM readings
 */
function getBGVelocity() {
  const readings = getReadings();
  let velocities = [];
  if (readings.length < 2) {
    return 0;
  }
  for (let i = 1; i < readings.length - 1; i++) {
    const lastReading = readings[i - 1];
    const currentReading = readings[i];
    const timeDiff = getHourDiff(
      currentReading.timestamp,
      lastReading.timestamp
    );
    const velocity = (currentReading.sugar - lastReading.sugar) / timeDiff;
    velocities.push(velocity);
  }
  // We give the median of all the velocities to rule out insane jumps
  return MathUtil.median(velocities);
}
// TODO: Remove
getBGVelocity;
