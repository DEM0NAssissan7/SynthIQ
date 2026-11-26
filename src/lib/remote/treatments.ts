import { Activity } from "react";
import Glucose from "../../models/events/glucose";
import Insulin, { InjectionPurpose } from "../../models/events/insulin";
import Meal from "../../models/events/meal";
import type MetaEvent from "../../models/events/metaEvent";
import { PreferencesStore } from "../../storage/preferencesStore";
import { round } from "../util";
import Backend, { selfID } from "./backend";

export const insulinEventType = "Meal Bolus";
export const basalEventType = "Temp Basal";
export const mealEventType = "Meal";
export const glucoseEventType = "Carb Correction";
export const activityEventType = "Exercise";
export const expirationRenewalType = "Medication Renewal";
export function getEventType(event: MetaEvent) {
  if (event instanceof Insulin && event.purpose !== InjectionPurpose.Basal)
    return insulinEventType;
  if (event instanceof Insulin && event.purpose === InjectionPurpose.Basal)
    return basalEventType;
  if (event instanceof Glucose) return glucoseEventType;
  if (event instanceof Meal) return mealEventType;
  if (event instanceof Activity) return activityEventType;
  return null;
}

class RemoteTreatments {
  static async getTreatments(timestampA: Date, timestampB: Date) {
    return await Backend.get(
      `treatments.json?find[created_at][$gte]=${timestampA.toString()}&find[created_at][$lte]=${timestampB.toString()}`,
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
    timestampB: Date,
  ) {
    const urlSafeEventType = eventType.replace(/ /g, "+");
    return await Backend.get(
      `treatments.json?&find[eventType]=${urlSafeEventType}&find[created_at][$gte]=${timestampA.toString()}&find[created_at][$lte]=${timestampB.toString()}`,
    );
  }
  static markMeal(
    name: string,
    _carbs: number,
    _protein: number,
    timestamp: Date,
  ): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    const carbs = round(_carbs, 1);
    const protein = round(_protein, 1);
    Backend.post(
      "treatments",
      {
        notes: `${name}: ${carbs}g / ${protein}g`,
        carbs: carbs,
        protein: protein,
        eventType: mealEventType,
      },
      timestamp,
    );
  }
  static markInsulin(
    units: number,
    timestamp: Date,
    variant: string,
    purpose: string,
  ): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    Backend.post(
      "treatments",
      {
        insulin: units,
        eventType: insulinEventType,
        notes: variant,
        purpose: purpose,
      },
      timestamp,
    );
  }
  static markBasal(units: number, timestamp: Date): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    Backend.post(
      "treatments",
      {
        insulin: units,
        eventType: basalEventType,
      },
      timestamp,
    );
  }
  static markGlucose(grams: number, timestamp: Date, variant: string): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    Backend.post(
      "treatments",
      {
        carbs: grams,
        eventType: glucoseEventType,
        notes: variant,
      },
      timestamp,
    );
  }
  static markActivity(name: string, timestamp: Date, minutes: number): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    Backend.post(
      "treatments",
      {
        notes: name,
        duration: minutes,
        eventType: activityEventType,
      },
      timestamp,
    );
  }
  /**
   * Remove a treatment this app uploaded. Uploads carry the event's own
   * timestamp as `created_at`, so the event's type and timestamp identify its
   * upload; `enteredBy` restricts it to this app's uploads, so a treatment
   * from another uploader at the same instant is never touched.
   */
  static removeTreatment(eventType: string, timestamp: Date): void {
    if (!PreferencesStore.uploadToBackend.value) return;

    const find = [
      // `$eq`: Nightscout's date filter rejects a bare date match
      `find[created_at][$eq]=${encodeURIComponent(timestamp.toISOString())}`,
      `find[eventType]=${encodeURIComponent(eventType)}`,
      `find[enteredBy]=${encodeURIComponent(selfID)}`,
    ].join("&");
    Backend.delete(`treatments/?${find}`);
  }
  static markExpirationRenewal(name: string, timestamp: Date) {
    if (!PreferencesStore.uploadToBackend.value) return;

    Backend.post(
      "treatments",
      {
        notes: `Replaced ${name}`,
        eventType: expirationRenewalType,
      },
      timestamp,
    );
  }
}

export default RemoteTreatments;
