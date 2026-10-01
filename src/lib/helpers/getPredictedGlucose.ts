/**
 * Uses current metabolic information to make a prediction about the user BG level at any given time
 */

import type SugarReading from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { BackendStore } from "../../storage/backendStore";
import { HealthMonitorStore } from "../../storage/healthMonitorStore";
import { getBGVelocity } from "../healthMonitor";
import { getHourDiff } from "../timing";
import { convertDimensions } from "../util";
import { estimateDynamicISF } from "./estimateDynamicISF";

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

export function getPredictedDelta(timestampA: Date, timestampB: Date): number {
  const readingsCache = HealthMonitorStore.readingsCache.value;
  const onBoardInsulins = HealthMonitorStore.recentBoluses.value;
  const lastRescue = HealthMonitorStore.lastRescue.value;
  const CGMDelay = BackendStore.cgmDelay.value; // CGM delay in minutes
  const isRescueBound =
    lastRescue.timestamp.getTime() +
      CGMDelay * convertDimensions(Unit.Time.Minute, Unit.Time.Millis) <
    timestampB.getTime();
  const dynamicISF = estimateDynamicISF(readingsCache, onBoardInsulins);
  const velocity = getBGVelocity(isRescueBound ? 2 : undefined);

  const velocityPredictedDelta = velocity * getHourDiff(timestampB, timestampA);
  const insulinPredictedDelta = isRescueBound
    ? 0
    : onBoardInsulins.reduce(
        (n, insulin) =>
          n - insulin.batemanIntegral(timestampA, timestampB) * dynamicISF,
        0,
      );

  if (velocityPredictedDelta <= 0)
    // Case 1: Both are falling - use the lowest dropping from the two of them
    return Math.min(velocityPredictedDelta, insulinPredictedDelta);

  // Case 2: Velocity says BG is rising - the insulin drop fights it
  return velocityPredictedDelta + insulinPredictedDelta;
}

export function getPredictedGlucose(timestamp: Date): number | null {
  const anchor = getLatestReading();
  if (!anchor) return null;
  // We run an integration sampling every 10 seconds
  const interval = 10 * convertDimensions(Unit.Time.Second, Unit.Time.Millis);
  let deltaSum = 0;
  for (
    let i = anchor.timestamp.getTime();
    i < timestamp.getTime();
    i += interval
  ) {
    const timestampA = new Date(anchor.timestamp.getTime() + i);
    const timestampB = new Date(anchor.timestamp.getTime() + i + interval);
    deltaSum += getPredictedDelta(timestampA, timestampB);
  }
  return anchor.sugar + deltaSum;
}
