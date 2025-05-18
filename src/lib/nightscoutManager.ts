import StorageNode from "./storageNode";
import { convertDimensions } from "./util";
import Unit from "../models/unit";

export const nightscoutStorage = new StorageNode("nightscout");
nightscoutStorage.add("url", "NULL");
nightscoutStorage.add("apiSecret", "");
nightscoutStorage.add("profileID", 0);
nightscoutStorage.add("minutesPerReading", 10);

class NightscoutManager {
  // Basic request stuff
  private static getApiPath(api: string): string {
    return `${nightscoutStorage.get("url")}/api/v1/${api}`;
  }
  private static async get(api: string, options?: any) {
    return fetch(this.getApiPath(api), {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-secret": nightscoutStorage.get("apiSecret"),
        "x-requested-with": "XMLHttpRequest",
      },
      mode: "cors",
      credentials: "omit",
      ...options, // allows override or extension
    })
      .then((a) => a.json())
      .catch(console.error);
  }
  private static async post(api: string, payload: any) {
    payload.enteredBy = "Ringsight";
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
    }).catch(console.error);
  }

  static addTreatment(treatment: object): void {
    this.post("treatments", treatment);
  }
  static async getProfile() {
    return this.get("profile").then(
      (a) => a[nightscoutStorage.get("profileID")]
    );
  }
  static async verifyAuth() {
    return this.get("verifyauth");
  }
  static async getCurrentSugar() {
    return this.get("entries").then((a) => a[0].sgv);
  }
  static async getReadings(timestampA: Date, timestampB: Date) {
    let count =
      ((timestampB.getTime() - timestampA.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Minute)) /
      nightscoutStorage.get("minutesPerReading");
    return this.get(
      `entries/sgv.json?find[date][$gte]=${timestampA.getTime()}&find[date][$lte]=${timestampB.getTime()}&count=${count}`
    );
  }
}

export default NightscoutManager;
