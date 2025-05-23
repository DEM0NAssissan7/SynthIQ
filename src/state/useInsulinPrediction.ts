import { useMemo } from "react";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import type Meal from "../models/meal";

/**
 * Hook that calculates insulin-related predictions from meal state.
 */
export default function useInsulinPrediction(
  meal: Meal,
  carbs: number,
  protein: number,
  currentGlucose: number,
  mutateMeal: boolean
) {
  return useMemo(() => {
    const insulinCorrection = getCorrectionInsulin(currentGlucose);
    const totalInsulin = getInsulin(carbs, protein) + insulinCorrection;
    const insulinTimestamp = getOptimalInsulinTiming(
      meal,
      totalInsulin,
      -2,
      12
    );
    if (mutateMeal) {
      meal.clearTestInsulins();
      meal.createTestInsulin(insulinTimestamp, totalInsulin);
    }
    return {
      insulin: totalInsulin,
      insulinCorrection,
      insulinTimestamp,
    };
  }, [carbs, protein, currentGlucose]);
}
