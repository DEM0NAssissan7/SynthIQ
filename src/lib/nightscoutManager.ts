import { convertDimensions, getTimestampFromOffset } from "./util";
import Unit from "../models/unit";
import Meal from "../models/meal";
import { nightscoutStore } from "../storage/nightscoutStore";

const selfID = "SynthIQ";

// Event types
const mealStoreEventType = "Meal Storage";
const insulinEventType = "Meal Bolus";
const mealEventType = "Meal";
const glucoseEventType = "Glucose Shot";

class NightscoutManager {
  // Basic request stuff
  private static getApiPath(api: string): string {
    return `${nightscoutStore.get("url")}/api/v1/${api}`;
  }
  private static async get(api: string, options?: any) {
    return await fetch(this.getApiPath(api), {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-secret": nightscoutStore.get("apiSecret"),
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
    payload.enteredBy = selfID;
    payload.timestamp = Date.now();
    return fetch(this.getApiPath(api), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "api-secret": nightscoutStore.get("apiSecret"),
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
      (a) => a[nightscoutStore.get("profileID")]
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
          nightscoutStore.get("minutesPerReading") *
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
      nightscoutStore.get("minutesPerReading");
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
      eventType: mealEventType,
    });
  }
  static markInsulin(units: number): void {
    this.post("treatments", {
      insulin: units,
      eventType: insulinEventType,
    });
  }
  static markGlucose(grams: number): void {
    this.post("treatments", {
      carbs: grams,
      eventType: glucoseEventType,
    });
  }

  // Meals
  /** This will store the ENTIRE meal
   * This includes its glucose, insulin, and foods
   * However, on nightscout, this will simply appear as a normal meal
   * This exists so that we can analyze an ENTIRE meal's data later
   */
  static storeMeal(meal: Meal) {
    this.post("treatments", {
      uuid: meal.uuid,
      eventType: mealStoreEventType,
      mealString: Meal.stringify(meal),
    });
  }
  static ignoreUUID(uuid: number) {
    let ignored = nightscoutStore.get("ignoredUUIDs");
    ignored.push(uuid);
    // console.log(ignored);
    nightscoutStore.set("ignoredUUIDs", ignored);
  }
  static clearIgnoredUUIDs() {
    nightscoutStore.set("ignoredUUIDs", []);
  }
  static uuidIsIgnored(uuid: number) {
    let ignored = nightscoutStore.get("ignoredUUIDs");
    for (let u of ignored) if (uuid === u) return true;
    return false;
  }
  static async getAllMeals() {
    /** We pull meals from nightscout that have been previously saved
     * This is crucial to do analysis.
     */
    let meals: Meal[] = [];
    let treatments = await this.get("treatments");
    // console.log(treatments);
    // console.log(treatments);
    treatments.forEach((t: any) => {
      if (
        t.eventType === mealStoreEventType &&
        t.enteredBy === selfID &&
        t.uuid &&
        t.mealString
      ) {
        if (this.uuidIsIgnored(t.uuid)) return;
        meals.push(Meal.parse(t.mealString));
      }
    });
    return meals;
  }
}

export default NightscoutManager;
