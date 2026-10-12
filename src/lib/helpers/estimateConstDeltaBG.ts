import Glucose from "../../models/events/glucose";
import Insulin from "../../models/events/insulin";
import SugarReading from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { hasTreatmentOverlap } from "./hasOverlap";

export function estimateConstDeltaBG(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  timestampA: Date,
  timestampB: Date,
  ISF: number | null = null,
): number {
  if (readings.length === 0) return 0;
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let sumDeltaBG = 0;
  let sumDt = 0;
  let sumInsulinEffect = 0;
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const reading = sortedReadings[i];
    const nextReading = sortedReadings[i + 1];

    const dt = nextReading.timestamp.getTime() - reading.timestamp.getTime();
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

    // See how many units were absorbed
    const insulinEffect = insulins.reduce(
      (n, insulin) =>
        n +
        insulin.batemanIntegral(reading.timestamp, nextReading.timestamp) *
          (ISF !== null ? ISF : insulin.variant.effect),
      0,
    );

    sumDeltaBG += deltaBG;
    sumInsulinEffect += insulinEffect;
    sumDt += dt;
  }
  if (sumDt <= 0) return 0;
  const mealRate = (sumDeltaBG + sumInsulinEffect) / sumDt;
  // Now we extrapolate out the deltaBG by using the mealRate subtract the insulin rate (assuming meal rate is constant)
  const deltaInsulinEffect = insulins.reduce(
    (n, insulin) =>
      n +
      insulin.batemanIntegral(timestampA, timestampB) *
        (ISF ? ISF : insulin.variant.effect),
    0,
  );
  const deltaTime = timestampB.getTime() - timestampA.getTime();
  const deltaMeal = mealRate * deltaTime;
  const deltaBG = deltaMeal - deltaInsulinEffect;
  return deltaBG;
}
