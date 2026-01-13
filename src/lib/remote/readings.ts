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
      getReadingFromNightscout(a[0])
    );
  }
  static async getReadings(
    timestampA: Date,
    timestampB: Date
  ): Promise<{ sgv: number; mbg: number; date: string }[]> {
    let count =
      ((timestampB.getTime() - timestampA.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Minute)) /
      BackendStore.minutesPerReading.value;
    return await Backend.get(
      `entries/sgv.json?find[date][$gte]=${timestampA.getTime()}&find[date][$lte]=${timestampB.getTime()}&count=${count}`
    );
  }
  static async getLatestReadings(count: number = 10) {
    return await Backend.get(`entries/sgv.json?count=${count}`);
  }
}

export default RemoteReadings;
