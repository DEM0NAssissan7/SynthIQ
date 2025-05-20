import StorageNode from "./storageNode";
import { convertDimensions, getTimestampFromOffset } from "./util";
import Unit from "../models/unit";
import Meal from "../models/meal";

export const nightscoutStorage = new StorageNode("nightscout");
nightscoutStorage.add("url", "NULL");
nightscoutStorage.add("apiSecret", "");
nightscoutStorage.add("profileID", 0);

// CGM
nightscoutStorage.add("minutesPerReading", 5);
nightscoutStorage.add("cgmDelay", 5);

class NightscoutManager {
  // Basic request stuff
  private static getApiPath(api: string): string {
    return `${nightscoutStorage.get("url")}/api/v1/${api}`;
  }
  private static async get(api: string, options?: any) {
    return await fetch(this.getApiPath(api), {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-secret": nightscoutStorage.get("apiSecret"),
        "x-requested-with": "XMLHttpRequest",
      },
      mode: "cors",
      credentials: "omit",
      ...options, // allows override or extension
    }).then((a) => {
      if (a.ok) {
        if (a) return a.json();
        else throw new Error("Nightscout: GET request gave invalid data");
      } else
        throw new Error(
          `Nightscout: GET request failed - HTTP status code '${a.status}'`
        );
    });
  }
  private static post(api: string, payload: any) {
    payload.enteredBy = "SynthIQ";
    payload.timestamp = Date.now();
    return fetch(this.getApiPath(api), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "api-secret": nightscoutStorage.get("apiSecret"),
        "content-type": "application/json; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      referrerPolicy: "strict-origin-when-cross-origin",
      body: JSON.stringify(payload),
      method: "POST",
      mode: "cors",
      credentials: "omit",
    });
  }

  // Basic Queries
  static addTreatment(treatment: object): void {
    this.post("treatments", treatment);
  }
  static async getProfile() {
    return await this.get("profile").then(
      (a) => a[nightscoutStorage.get("profileID")]
    );
  }
  static async verifyAuth() {
    return await this.get("verifyauth");
  }
  static async getSugarAt(timestamp: Date) {
    return await this.getReadings(
      timestamp,
      getTimestampFromOffset(
        timestamp,
        2 *
          nightscoutStorage.get("minutesPerReading") *
          convertDimensions(Unit.Time.Minute, Unit.Time.Hour)
      )
    ).then((a) => a[a.length - 1]);
  }
  static async getCurrentSugar() {
    return await this.get("entries").then((a) => a[0].sgv);
  }
  static async getReadings(timestampA: Date, timestampB: Date) {
    let count =
      ((timestampB.getTime() - timestampA.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Minute)) /
      nightscoutStorage.get("minutesPerReading");
    return await this.get(
      `entries/sgv.json?find[date][$gte]=${timestampA.getTime()}&find[date][$lte]=${timestampB.getTime()}&count=${count}`
    );
  }

  /* Complex Requests */
  static markMeal(carbs: number, protein: number): void {
    this.post("treatments", {
      notes: `${carbs}/${protein}`,
      carbs: carbs,
      protein: protein,
      eventType: "Meal",
    });
  }
  static markInsulin(units: number): void {
    this.post("treatments", {
      insulin: units,
      eventType: "Meal Bolus",
    });
  }
  static markGlucose(grams: number): void {}

  // Meals
  /** This will store the ENTIRE meal
   * This includes its glucose, insulin, and foods
   * However, on nightscout, this will simply appear as a normal meal
   * This exists so that we can analyze an ENTIRE meal's data later
   */
  static storeMeal(meal: Meal) {
    this.post("treatments", {
      uuid: meal.uuid,
      eventType: "Meal Storage",
      meal: Meal.stringify(meal),
    });
  }
}

export default NightscoutManager;
