import { useMemo } from "react";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalDualSplit,
} from "../lib/metabolism";
import type Session from "../models/session";

export default function useSplitInsulinPrediction(
  session: Session,
  carbs: number,
  protein: number,
  currentGlucose: number,
  mutateMeal: boolean,
  active: boolean = true
) {
  return useMemo(() => {
    let insulinCorrection: number = 0,
      totalInsulin: number = 0,
      firstInsulinUnits: number = 0,
      firstInsulinTime: Date = new Date(),
      secondInsulinUnits: number = 0,
      secondInsulinTime: Date = new Date();
    if (active) {
      insulinCorrection = getCorrectionInsulin(currentGlucose);
      totalInsulin = getInsulin(carbs, protein) + insulinCorrection;
      const insulins = getOptimalDualSplit(session, totalInsulin, -1.5, 8);
      if (mutateMeal) {
        session.clearTestInsulins();
        insulins.forEach((a) => {
          session.createTestInsulin(a.timestamp, a.units);
        });
      }
      const firstInsulin = insulins[0];
      firstInsulinUnits = firstInsulin.units;
      firstInsulinTime = firstInsulin.timestamp;

      const secondInsulin = insulins[1];
      if (secondInsulin) {
        secondInsulinUnits = secondInsulin.units;
        secondInsulinTime = secondInsulin.timestamp;
      } else {
        secondInsulinUnits = 0;
        secondInsulinTime = new Date();
      }
    }
    return {
      insulin: totalInsulin,
      insulinCorrection,
      firstInsulinUnits,
      firstInsulinTime,
      secondInsulinUnits,
      secondInsulinTime,
    };
  }, [carbs, protein, currentGlucose, active]);
}
