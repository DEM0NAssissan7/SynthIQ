import { round } from "../util";
import Backend from "./backend";

export const insulinEventType = "Meal Bolus";
export const basalEventType = "Basal Insulin";
export const mealEventType = "Meal";
export const glucoseEventType = "Carb Correction";
export const activityEventType = "Exercise";

class RemoteTreatments {
  static async getTreatments(timestampA: Date, timestampB: Date) {
    return await Backend.get(
      `treatments.json?find[created_at][$gte]=${timestampA.toString()}&find[created_at][$lte]=${timestampB.toString()}`
    ).then((a: any[]) => {
      if (typeof a !== "object") return [];
      return a.map((b: any) => {
        b.timestamp = new Date(b.created_at);
        return b;
      });
    });
  }
  static async getTreatmentByType(
    eventType: string,
    timestampA: Date,
    timestampB: Date
  ) {
    const urlSafeEventType = eventType.replace(/ /g, "+");
    return await Backend.get(
      `treatments.json?&find[eventType]=${urlSafeEventType}&find[created_at][$gte]=${timestampA.toString()}&find[created_at][$lte]=${timestampB.toString()}`
    );
  }
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
  static markInsulin(units: number, timestamp: Date, variant: string): void {
    Backend.post(
      "treatments",
      {
        insulin: units,
        eventType: insulinEventType,
        notes: variant,
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
  static markActivity(name: string, timestamp: Date, minutes: number): void {
    Backend.post(
      "treatments",
      {
        notes: name,
        duration: minutes,
        eventType: activityEventType,
      },
      timestamp
    );
  }
}

export default RemoteTreatments;
