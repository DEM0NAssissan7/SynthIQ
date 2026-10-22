/**
 * Uses current metabolic information to make a prediction about the user BG level at any given time
 */

import type Glucose from "../../models/events/glucose";
import type Insulin from "../../models/events/insulin";
import type SugarReading from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { convertDimensions } from "../util";
import { estimateDynamicISF } from "./estimateDynamicISF";

const ALPHA = 0.85; // CGM Smoothing factor (1 is no smoothing)
const BETA = 0.35; // Velocity change damping factor (1 means velocity changes instantly)
const PHI = 0.8; // Moving velocity decay constant (1 means no velocity decay)
const PERIOD = 5;

function getIntegratedDelta(
  velocityPerPeriod: number,
  periods: number,
  phi: number,
): number {
  if (periods <= 0) return 0;
  // Closed-form integral: v0 * (phi / (1 - phi)) * (1 - phi^periods)
  return (velocityPerPeriod / (1.0 - phi)) * (1.0 - Math.pow(phi, periods));
}

export function getRefReading(readings: SugarReading[]): SugarReading | null {
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (sortedReadings.length === 0) return null;
  return sortedReadings[sortedReadings.length - 1];
}

export function getPredictedGlucose(
  readings: SugarReading[],
  timestamp: Date,
  insulins: Insulin[],
  rescues: Glucose[],
): number | null {
  if (readings.length < 2) return null;
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  /**
   * The model works with a moving average
   */
  // First we look into the past to get our weighted avg velocity
  let velocity: number | null = null;
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const reading = sortedReadings[i];
    const nextReading = sortedReadings[i + 1];
    const dt =
      (nextReading.timestamp.getTime() - reading.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Minute);
    if (dt <= 0) continue;
    if (velocity === null) {
      velocity = (nextReading.sugar - reading.sugar) / dt;
      continue;
    }

    // Coefficient scaling
    const periods = dt / PERIOD;
    const alpha = 1 - Math.pow(1 - ALPHA, periods);
    const beta = 1 - Math.pow(1 - BETA, periods);

    const modelPredictedBG =
      reading.sugar + getIntegratedDelta(velocity * PERIOD, periods, PHI);
    const smoothedBG: number =
      nextReading.sugar * alpha + modelPredictedBG * (1 - alpha);

    const deltaBG = smoothedBG - reading.sugar;
    const decayedPriorVelocity: number = velocity * Math.pow(PHI, periods);
    velocity = (deltaBG / dt) * beta + decayedPriorVelocity * (1 - beta);
  }
  if (velocity === null || !Number.isFinite(velocity)) return null;

  // Predict future BG anchored to the latest actual reading
  const finalReading = getRefReading(readings);
  if (!finalReading) return null;
  const finalTimestamp = finalReading.timestamp;
  const deltaTime =
    (timestamp.getTime() - finalTimestamp.getTime()) *
    convertDimensions(Unit.Time.Millis, Unit.Time.Minute);

  if (deltaTime <= 0) {
    return finalReading.sugar;
  }

  const predicted =
    finalReading.sugar +
    getIntegratedDelta(velocity * PERIOD, deltaTime / PERIOD, PHI);
  if (!Number.isFinite(predicted)) return finalReading.sugar;

  // Now (if applicable) we look at the dynamicISF and the readings
  if (insulins && rescues) {
    const dynamicISF = estimateDynamicISF(readings, insulins, rescues);
    // Extrapolate insulin absorption into the future
    const predictedUnitsAbsorbed = insulins.reduce(
      (n, i) => n + i.batemanIntegral(finalTimestamp, timestamp),
      0,
    );
    // Apply the dynamic ISF
    const insulinPredictedGlucose =
      finalReading.sugar - predictedUnitsAbsorbed * dynamicISF;
    if (
      insulinPredictedGlucose < predicted &&
      Number.isFinite(insulinPredictedGlucose)
    )
      return insulinPredictedGlucose;
  }
  return predicted;
}
