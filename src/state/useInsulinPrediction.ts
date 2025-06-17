import { useMemo } from "react";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import type MetaEvent from "../models/event";

/**
 * Hook that calculates insulin-related predictions from meal state.
 */
export default function useInsulinPrediction(
  event: MetaEvent,
  carbs: number,
  protein: number,
  currentGlucose: number,
  mutateMeal: boolean
) {
  return useMemo(() => {
    const insulinCorrection = getCorrectionInsulin(currentGlucose);
    const totalInsulin = getInsulin(carbs, protein) + insulinCorrection;
    const insulinTimestamp = getOptimalInsulinTiming(
      event,
      totalInsulin,
      -2,
      12
    );
    if (mutateMeal) {
      event.clearTestInsulins();
      event.createTestInsulin(insulinTimestamp, totalInsulin);
    }
    return {
      insulin: totalInsulin,
      insulinCorrection,
      insulinTimestamp,
    };
  }, [carbs, protein, currentGlucose]);
}
