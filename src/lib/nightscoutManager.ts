import { convertDimensions, round } from "./util";
import Unit from "../models/unit";
import Meal from "../models/meal";
import { nightscoutStore } from "../storage/nightscoutStore";
import { getTimestampFromOffset } from "./timing";
import { changeProfile, profile } from "../storage/metaProfileStore";
import MetabolismProfile from "../models/metabolism/metabolismProfile";
import RequestType from "../models/requestType";
import RequestQueue from "../models/requestQueue";

const selfID = "SynthIQ";

// Event types
const mealStoreEventType = "Meal Storage";
const insulinEventType = "Meal Bolus";
const mealEventType = "Meal";
const glucoseEventType = "Carb Correction";

// Developer options
const errorLogging = false;

// Request Queue Management
function addRequest(type: RequestType, api: string, payload?: any, timestamp?: Date): void {
  const queue = nightscoutStore.get("queue");
  queue.push(new RequestQueue(type, api, payload, timestamp));
  nightscoutStore.write("queue");
}
function fullfilRequest(request: RequestQueue): void {
  const queue = nightscoutStore.get("queue");
  nightscoutStore.set("queue", queue.filter((a: RequestQueue) => a.uuid !== request.uuid));
}

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
      } else if(errorLogging)
        throw new Error(
          `Nightscout: GET request failed - HTTP status code '${a.status}'`
        );
    }).catch((e) => {
      if(errorLogging) console.error(e);
    });
  }
  private static postRequest(api: string, payload: any, timestamp: Date) {
    payload.enteredBy = selfID;
    payload.timestamp = timestamp;
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
  private static putRequest(api: string, payload: any) {
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
      method: "PUT",
      mode: "cors",
      credentials: "omit",
    });
  }

  // REST Queue
  private static post(api: string, payload: any, timestamp: Date): void {
    addRequest(RequestType.POST, api, timestamp, payload);
    this.fulfillRequests();
  }
  private static put(api: string, payload: any): void {
    addRequest(RequestType.PUT, api, payload);
    this.fulfillRequests();
  }
  static fulfillRequests(): void {
    const queue = nightscoutStore.get("queue");
    for(let request of queue) {
      const api = request.api;
      const payload = request.payload;
      const timestamp = request.timestamp;
      const fulfill = () => {
        fullfilRequest(request);
      }
      switch(request.type) {
        case RequestType.POST:
          this.postRequest(api, payload, timestamp).then(fulfill);
          break;
        case RequestType.PUT:
          this.putRequest(api, payload).then(fulfill);
          break;
      }
    }
  }

  // Basic Queries
  static async getProfiles() {
    return await this.get("profile")
  }
  static async getProfile() {
    return await this.getProfiles().then(
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
    ).then((a) => {
      if(a)
      return a[a.length - 1]
    });
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
  static markMeal(_carbs: number, _protein: number, timestamp: Date): void {
    const carbs = round(_carbs, 1);
    const protein = round(_protein, 1);
    this.post("treatments", {
      notes: `${carbs}/${protein}`,
      carbs: carbs,
      protein: protein,
      eventType: mealEventType,
    }, timestamp);
  }
  static markInsulin(units: number, timestamp: Date): void {
    this.post("treatments", {
      insulin: units,
      eventType: insulinEventType,
    }, timestamp);
  }
  static markGlucose(caps: number, timestamp: Date): void {
    this.post("treatments", {
      carbs: caps,
      eventType: glucoseEventType,
    }, timestamp);
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
    }, new Date());
    /* We don't need to give this a timestamp as it's
     * already stored in the meal object
    */
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

  // Metabolic Profile
  static async loadMetaProfile() {
    this.getProfile().then(a => {
      if(a.metaProfile)
        changeProfile(MetabolismProfile.parse(a.metaProfile));
    })
  }
  static async storeMetaProfile() {
    this.getProfile().then(p => {
      p.metaProfile = MetabolismProfile.stringify(profile);
      this.put("profile", p);
    })
  }

  // Meta
  static urlIsValid() {
    return nightscoutStore.get("url") !== null;
  }
  static getNightscoutSkipped() {
    return nightscoutStore.get("skipSetup");
  }
  static skipNightscoutSetup() {
    nightscoutStore.set("skipSetup", true);
  }
}

export default NightscoutManager;
