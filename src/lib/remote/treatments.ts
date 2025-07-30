import { round } from "../util";
import Backend from "./backend";

export const basalEventType = "Basal Insulin";

class RemoteTreatments {
  static markMeal(_carbs: number, _protein: number, timestamp: Date): void {
    const carbs = round(_carbs, 1);
    const protein = round(_protein, 1);
    Backend.post(
      "treatments",
      {
        notes: `${carbs}g / ${protein}g`,
        carbs: carbs,
        protein: protein,
        eventType: mealEventType,
      },
      timestamp
    );
  }
  static markInsulin(units: number, timestamp: Date): void {
    Backend.post(
      "treatments",
      {
        insulin: units,
        eventType: insulinEventType,
      },
      timestamp
    );
  }
  static markBasal(units: number, timestamp: Date): void {
    Backend.post(
      "treatments",
      {
        insulin: units,
        eventType: basalEventType,
      },
      timestamp
    );
  }
  static markGlucose(caps: number, timestamp: Date): void {
    Backend.post(
      "treatments",
      {
        carbs: caps,
        eventType: glucoseEventType,
      },
      timestamp
    );
  }
}

export default RemoteTreatments;
