import type Glucose from "../../models/events/glucose";
import type Insulin from "../../models/events/insulin";
import type SugarReading from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { convertDimensions } from "../util";
import { hasTreatmentOverlap } from "./hasOverlap";

function estimateDynamicMetabolicActivity(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
): [number, number] {
  if (readings.length === 0) return [0, 0];
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Now we sample the insulins from the specified start time, ignoring any windows containing rescues
  let sumFastingDeltaBG = 0;
  let sumFastingDt = 0;
  let sumDeltaBG = 0;
  let sumUnits = 0;
  let sumDt = 0;
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const reading = sortedReadings[i];
    const nextReading = sortedReadings[i + 1];

    const dt =
      (nextReading.timestamp.getTime() - reading.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Hour);
    const deltaBG = nextReading.sugar - reading.sugar;

    // Check if either reading is being influenced by rescue
    const isRescueBound = rescues.reduce(
      (val, rescue) =>
        val ||
        hasTreatmentOverlap(reading.timestamp, rescue, Unit.Time.Minute) ||
        hasTreatmentOverlap(nextReading.timestamp, rescue, Unit.Time.Minute),
      false,
    );
    // If we are being influenced by a rescue, keep going and ignore
    if (isRescueBound) continue;

    // See how many units were absorbe
    const unitsAbsorbed = insulins.reduce(
      (n, insulin) =>
        n + insulin.batemanIntegral(reading.timestamp, nextReading.timestamp),
      0,
    );
    // Note: batemanIntegral without the 3rd parameter being true will yeild the insulin absorbed in the window
    if (unitsAbsorbed <= 0.005) {
      // If basically no insulin is absorbed, we consider it fasting
      sumFastingDeltaBG += deltaBG;
      sumFastingDt += dt;
      continue;
    }

    sumDeltaBG += deltaBG;
    sumUnits += unitsAbsorbed;
    sumDt += dt;
  }
  // Calculate constant background BG rate drop
  const fastingBGRate =
    sumFastingDt !== 0 ? sumFastingDeltaBG / sumFastingDt : 0;

  // Safeguard
  if (sumUnits === 0 || sumDeltaBG > 0) return [0, fastingBGRate];

  /**
   * Now that we have the raw deltas and the fasting BG rates,
   * we reverse extrapolate how much "fasting" influenced the
   * insulin-active readings
   * */
  const backgroundFastingInfluence = fastingBGRate * sumDt;
  let adjustedDeltaBG = sumDeltaBG - backgroundFastingInfluence;
  // If our reverse calculation ends up making the dynamic ISF greater than 1, we ignore it and just use the normal deltaBG
  if (adjustedDeltaBG > 0) adjustedDeltaBG = sumDeltaBG;

  const dynamicISF = -adjustedDeltaBG / sumUnits; // Make it negative because ISF is a positive value
  return [dynamicISF, fastingBGRate];
}

export function estimateDynamicISF(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
): number {
  return estimateDynamicMetabolicActivity(readings, insulins, rescues)[0];
}

export function estimateFastingBG(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
): number {
  return estimateDynamicMetabolicActivity(readings, insulins, rescues)[1];
}
