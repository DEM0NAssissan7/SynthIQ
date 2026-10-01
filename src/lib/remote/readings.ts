import { getReadingFromNightscout } from "../../models/types/sugarReading";
import Unit from "../../models/unit";
import { BackendStore } from "../../storage/backendStore";
import { getTimestampFromOffset } from "../timing";
import { convertDimensions } from "../util";
import Backend from "./backend";

class RemoteReadings {
  static async getSugarAt(timestamp: Date) {
    return await this.getReadings(
      timestamp,
      getTimestampFromOffset(
        timestamp,
        2 *
          BackendStore.minutesPerReading.value *
          convertDimensions(Unit.Time.Minute, Unit.Time.Hour)
      )
    ).then((a) => {
      if (a.length === 0) return null;
      if (a) return a[a.length - 1];
    });
  }
  static async getCurrentSugar() {
    return await Backend.get("entries.json").then((a) =>
      a && a[0] ? getReadingFromNightscout(a[0]) : null
    );
  }
  static async getReadings(
    timestampA: Date,
    timestampB: Date
  ): Promise<{ sgv?: number; mbg?: number; date?: string | number; dateString?: string; type?: string }[]> {
    const timeA = timestampA.getTime();
    const timeB = timestampB.getTime();
    const minTime = Math.min(timeA, timeB);
    const maxTime = Math.max(timeA, timeB);
    const minDate = new Date(minTime);
    const maxDate = new Date(maxTime);

    const durationMinutes =
      (maxTime - minTime) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Minute);
    const count = Math.max(
      20,
      Math.ceil(durationMinutes / (BackendStore.minutesPerReading.value || 5)) + 10
    );

    // Nightscout date range queries:
    // In Nightscout MongoDB, `date` is a numeric epoch field. Querying `find[date][$gte]=<val>` fails
    // in standard Nightscout instances because Express query strings parse all parameters as strings,
    // which yields 0 matches in BSON numeric comparisons.
    // Querying by ISO `find[dateString][$gte]=...` matches the string field properly.
    const queryDateString = `find[dateString][$gte]=${minDate.toISOString()}&find[dateString][$lte]=${maxDate.toISOString()}&count=${count}`;

    try {
      let res = await Backend.get(`entries/sgv.json?${queryDateString}`);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      // Fallback 1: Query entries.json using dateString
      res = await Backend.get(`entries.json?${queryDateString}`);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      // Fallback 2: Query entries/sgv.json using numeric epoch
      const queryDateNumeric = `find[date][$gte]=${minTime}&find[date][$lte]=${maxTime}&count=${count}`;
      res = await Backend.get(`entries/sgv.json?${queryDateNumeric}`);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
      // Fallback 3: Query entries.json using numeric epoch
      res = await Backend.get(`entries.json?${queryDateNumeric}`);
      if (Array.isArray(res)) {
        return res;
      }
      return [];
    } catch (e) {
      console.error("RemoteReadings.getReadings failed:", e);
      return [];
    }
  }
  static async getLatestReadings(count: number = 10) {
    return await Backend.get(`entries/sgv.json?count=${count}`);
  }
}

export default RemoteReadings;
