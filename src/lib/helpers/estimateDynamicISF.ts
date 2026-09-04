import type Insulin from "../../models/events/insulin";
import type SugarReading from "../../models/types/sugarReading";
import { MathUtil } from "../util";

export function estimateDynamicISF(
  readings: SugarReading[],
  insulins: Insulin[],
): number {
  // The method here is to calculate what the total drop in
  const dynamicISFs: number[] = [];
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const reading = sortedReadings[i];
    const nextReading = sortedReadings[i + 1];

    // Timing guards
    const timeDeltaMin =
      (nextReading.timestamp.getTime() - reading.timestamp.getTime()) / 60000;
    if (timeDeltaMin <= 0 || timeDeltaMin > 15) continue;

    const deltaBG = nextReading.sugar - reading.sugar;
    if (deltaBG >= 0) continue; // If glucose did not drop, skip it it's garbage
    const unitsAbsorbed = insulins.reduce(
      (n, insulin) =>
        n + insulin.batemanIntegral(reading.timestamp, nextReading.timestamp),
      0,
    );
    // Note: batemanIntegral without the 3rd parameter being true will yeild the insulin absorbed in the window
    if (unitsAbsorbed <= 0.005) continue;
    const dynamicISF = -deltaBG / unitsAbsorbed;
    if (dynamicISF > 100) continue; // If this is pure garbage, discard it
    dynamicISFs.push(dynamicISF);
  }
  return MathUtil.median(dynamicISFs); // Return the median ISF for all shots (note: median returns 0 for no values)
}
