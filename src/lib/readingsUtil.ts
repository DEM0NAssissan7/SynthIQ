import type SugarReading from "../models/types/sugarReading";
import { getHourDiff } from "./timing";

/** This function returns (mg/dL) / hr.
 * It describes how quickly blood sugar is moving based on the readings
 */
export function getBGVelocities(readings: SugarReading[]): number[] {
  const velocities: number[] = [];
  if (readings.length < 2) {
    return [];
  }
  const sorted = readings
    .slice()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentReading = sorted[i];
    const lastReading = sorted[i + 1];
    const timeDiff = getHourDiff(
      currentReading.timestamp,
      lastReading.timestamp,
    );
    if (timeDiff <= 0) continue;
    const velocity = (currentReading.sugar - lastReading.sugar) / timeDiff;
    if (Number.isFinite(velocity)) velocities.push(velocity);
  }
  return velocities;
}
