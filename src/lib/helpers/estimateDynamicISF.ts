import type Glucose from "../../models/events/glucose";
import type Insulin from "../../models/events/insulin";
import type Meal from "../../models/events/meal";
import type SugarReading from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { BasalStore } from "../../storage/basalStore";
import { getTimestampFromOffset } from "../timing";
import { convertDimensions, firstIndexWhere, MathUtil } from "../util";
import { BackendStore } from "../../storage/backendStore";
import { hasTreatmentOverlap } from "./hasOverlap";

export function estimateDynamicMetabolicActivity(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  clamp = true,
  lookbackHours: number | null = 1,
  meals: Meal[] = [],
): [number, number] {
  if (readings.length === 0) return [0, 0];
  const sortedReadings = readings
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const lastReading = sortedReadings[sortedReadings.length - 1];
  if (!lastReading) return [0, 0];
  const cutoff =
    lookbackHours !== null
      ? getTimestampFromOffset(lastReading.timestamp, -lookbackHours)
      : null;
  const filteredReadings = sortedReadings.filter((r) =>
    cutoff !== null ? r.timestamp.getTime() >= cutoff.getTime() : true,
  );

  // Now we sample the insulins from the specified start time, ignoring any windows containing rescues
  let sumFastingDeltaBG = 0;
  let sumFastingDt = 0;
  let sumDeltaBG = 0;
  let sumUnits = 0;
  let sumDt = 0;
  const readingTimeDeltas = (() => {
    const deltas = [];
    for (let i = 0; i < filteredReadings.length - 1; i++)
      deltas.push(
        (filteredReadings[i + 1].timestamp.getTime() -
          filteredReadings[i].timestamp.getTime()) *
          convertDimensions(Unit.Time.Millis, Unit.Time.Hour),
      );
    return deltas;
  })();
  const avgDelta = MathUtil.mean(readingTimeDeltas);

  // Treatments in time order, so each window only checks those that can touch it
  const byTime = (a: { timestamp: Date }, b: { timestamp: Date }) =>
    a.timestamp.getTime() - b.timestamp.getTime();
  const sortedRescues = rescues.slice().sort(byTime);
  const sortedMeals = meals.slice().sort(byTime);
  const sortedInsulins = insulins.slice().sort(byTime);
  const cgmDelay =
    BackendStore.cgmDelay.value *
    convertDimensions(Unit.Time.Minute, Unit.Time.Millis);
  const longestRescue =
    sortedRescues.reduce((m, r) => Math.max(m, r.variant.duration), 0) *
    convertDimensions(Unit.Time.Minute, Unit.Time.Millis);
  const mealSpan =
    BasalStore.minTimeSinceMeal.value *
    convertDimensions(Unit.Time.Hour, Unit.Time.Millis);
  /** The treatments that started strictly between two times */
  const startedBetween = <T extends { timestamp: Date }>(
    sorted: T[],
    from: number,
    to: number,
  ) =>
    sorted.slice(
      firstIndexWhere(sorted, (e) => e.timestamp.getTime() > from),
      firstIndexWhere(sorted, (e) => e.timestamp.getTime() >= to),
    );

  for (let i = 0; i < filteredReadings.length - 1; i++) {
    const reading = filteredReadings[i];
    const nextReading = filteredReadings[i + 1];

    const dt =
      (nextReading.timestamp.getTime() - reading.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Hour);
    if (dt > avgDelta * 2) continue;
    const deltaBG = nextReading.sugar - reading.sugar;
    // A treatment acts on a reading from its start plus the CGM delay until
    // the end of its span, so only these can act on either reading
    const startTime = reading.timestamp.getTime() - cgmDelay;
    const endTime = nextReading.timestamp.getTime() - cgmDelay;

    // Check if either reading is being influenced by rescue
    const isRescueBound = startedBetween(
      sortedRescues,
      startTime - longestRescue,
      endTime,
    ).reduce(
      (val, rescue) =>
        val ||
        hasTreatmentOverlap(reading.timestamp, rescue, Unit.Time.Minute) ||
        hasTreatmentOverlap(nextReading.timestamp, rescue, Unit.Time.Minute),
      false,
    );
    // If we are being influenced by a rescue, keep going and ignore
    if (isRescueBound) continue;
    // Check if either reading is being influenced by a meal
    const isMealBound = startedBetween(
      sortedMeals,
      startTime - mealSpan,
      endTime,
    ).reduce((val, meal) => {
      const simulatedTreatment = {
        timestamp: meal.timestamp,
        variant: { duration: BasalStore.minTimeSinceMeal.value },
      };
      return (
        val ||
        hasTreatmentOverlap(
          reading.timestamp,
          simulatedTreatment,
          Unit.Time.Hour,
        ) ||
        hasTreatmentOverlap(
          nextReading.timestamp,
          simulatedTreatment,
          Unit.Time.Hour,
        )
      );
    }, false);
    // If we are meal-bound, we don't bother
    if (isMealBound) continue;

    // See how many units were absorbe. A dose taken after the window absorbs nothing in it
    const unitsAbsorbed = sortedInsulins
      .slice(
        0,
        firstIndexWhere(
          sortedInsulins,
          (e) => e.timestamp.getTime() >= nextReading.timestamp.getTime(),
        ),
      )
      .reduce(
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
    sumFastingDt > 0.25 ? sumFastingDeltaBG / sumFastingDt : 0;

  // Clamping
  if (clamp && (sumUnits === 0 || sumDeltaBG > 0)) return [0, fastingBGRate];

  /**
   * Now that we have the raw deltas and the fasting BG rates,
   * we reverse extrapolate how much "fasting" influenced the
   * insulin-active readings
   * */
  if (lookbackHours !== null) {
    const backgroundFastingInfluence = fastingBGRate * sumDt;
    let adjustedDeltaBG = sumDeltaBG - backgroundFastingInfluence;
    // If our reverse calculation ends up making the dynamic ISF greater than 1, we ignore it and just use the normal deltaBG
    if (adjustedDeltaBG <= 0) sumDeltaBG = adjustedDeltaBG;
  }

  const dynamicISF = -sumDeltaBG / sumUnits; // Make it negative because ISF is a positive value
  // If dynamic ISF comes out to be some ridiculous number, we discard it
  if (dynamicISF > 500) return [0, fastingBGRate];
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
