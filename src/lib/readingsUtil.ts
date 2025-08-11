import type SugarReading from "../models/types/sugarReading";
import { getHourDiff } from "./timing";

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the readings
 */
export function getBGVelocities(readings: SugarReading[]): number[] {
  let velocities = [];
  if (readings.length < 2) {
    return [];
  }
  for (let i = 0; i < readings.length - 1; i++) {
    const currentReading = readings[i];
    const lastReading = readings[i + 1];
    const timeDiff = getHourDiff(
      currentReading.timestamp,
      lastReading.timestamp
    );
    const velocity = (currentReading.sugar - lastReading.sugar) / timeDiff;
    velocities.push(velocity);
  }
  return velocities;
}
