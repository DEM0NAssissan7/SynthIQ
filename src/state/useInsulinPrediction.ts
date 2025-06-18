import { useMemo } from "react";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import type Session from "../models/session";

/**
 * Hook that calculates insulin-related predictions from meal state.
 */
export default function useInsulinPrediction(
  session: Session,
  carbs: number,
  protein: number,
  currentGlucose: number,
  mutateMeal: boolean
) {
  return useMemo(() => {
    const insulinCorrection = getCorrectionInsulin(currentGlucose);
    const totalInsulin = getInsulin(carbs, protein) + insulinCorrection;
    const insulinTimestamp = getOptimalInsulinTiming(
      session,
      totalInsulin,
      -2,
      12
    );
    if (mutateMeal) {
      session.clearTestInsulins();
      session.createTestInsulin(insulinTimestamp, totalInsulin);
    }
    return {
      insulin: totalInsulin,
      insulinCorrection,
      insulinTimestamp,
    };
  }, [carbs, protein, currentGlucose]);
}
