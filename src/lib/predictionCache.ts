/**
 * Memoized wrappers around the glucose predictor.
 *
 * Kept outside glucosePrediction.ts (a version-locked file, see r1Weights
 * base_version) so the locked sources stay untouched.
 *
 * getPredictedGlucoseAccuracy is a pure function of its arguments: the base
 * predictor, dynamic ISF and r1 read no app state, and the base-version check
 * is a constant canary (whether r1 is applied is an explicit argument,
 * part of the key). Results are therefore cached on a key holding every
 * input value the computation reads, so a hit is exactly what recomputing
 * would return. Mutating a reading/treatment changes its key, so edits are
 * picked up automatically.
 */

import type Glucose from "../models/events/glucose";
import type Insulin from "../models/events/insulin";
import type SugarReading from "../models/types/sugarReading";
import {
  getPredictedGlucoseAccuracy,
  type R1Context,
} from "./glucosePrediction";

const ACCURACY_CACHE_MAX = 16;
const accuracyCache = new Map<
  string,
  ReturnType<typeof getPredictedGlucoseAccuracy>
>();

function readingsKey(readings: SugarReading[]): string {
  return readings
    .map(
      (r) => `${r.timestamp.getTime()}:${r.sugar}:${r.isCalibration ? 1 : 0}`,
    )
    .join(",");
}

function insulinsKey(insulins: Insulin[]): string {
  return insulins
    .map((i) => {
      const v = i.variant;
      return `${i.timestamp.getTime()}:${i.value}:${v.name}:${v.effect}:${v.daysLife}:${v.ka}:${v.ke}:${v.t0}`;
    })
    .join(",");
}

function rescuesKey(rescues: Glucose[]): string {
  return rescues
    .map((g) => {
      const v = g.variant;
      return `${g.timestamp.getTime()}:${g.value}:${v.name}:${v.duration}:${v.carbs}:${v.effect}`;
    })
    .join(",");
}

function contextKey(ctx?: R1Context): string {
  if (!ctx) return "-";
  const meals = (ctx.meals ?? [])
    .map((m) => `${m.timeMs}:${m.carbs}:${m.protein}`)
    .join(",");
  const basal = (ctx.basalTimesMs ?? []).join(",");
  return `${meals}/${basal}`;
}

/** getPredictedGlucoseAccuracy, memoized on the exact values of its inputs. */
export function getPredictedGlucoseAccuracyCached(
  readings: SugarReading[],
  insulins: Insulin[],
  rescues: Glucose[],
  timeframe: number,
  r1Context?: R1Context,
  useR1: boolean = true,
): ReturnType<typeof getPredictedGlucoseAccuracy> {
  const key = [
    useR1 ? "r1" : "base",
    timeframe,
    readingsKey(readings),
    insulinsKey(insulins),
    rescuesKey(rescues),
    contextKey(r1Context),
  ].join("|");

  if (accuracyCache.has(key)) {
    const hit = accuracyCache.get(key)!;
    accuracyCache.delete(key);
    accuracyCache.set(key, hit);
    return hit === null ? null : { ...hit };
  }

  const result = getPredictedGlucoseAccuracy(
    readings,
    insulins,
    rescues,
    timeframe,
    r1Context,
    useR1,
  );
  accuracyCache.set(key, result);
  if (accuracyCache.size > ACCURACY_CACHE_MAX)
    accuracyCache.delete(accuracyCache.keys().next().value as string);
  return result === null ? null : { ...result };
}
