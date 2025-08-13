import Unit from "../../models/unit";
import { backendStore } from "../../storage/backendStore";
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
          backendStore.get("minutesPerReading") *
          convertDimensions(Unit.Time.Minute, Unit.Time.Hour)
      )
    ).then((a) => {
      if (a) return a[a.length - 1];
    });
  }
  static async getCurrentSugar() {
    return await Backend.get("entries.json").then((a) => a[0].sgv);
  }
  static async getReadings(
    timestampA: Date,
    timestampB: Date
  ): Promise<{ sgv: number; date: string }[]> {
    let count =
      ((timestampB.getTime() - timestampA.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Minute)) /
      backendStore.get("minutesPerReading");
    return await Backend.get(
      `entries/sgv.json?find[date][$gte]=${timestampA.getTime()}&find[date][$lte]=${timestampB.getTime()}&count=${count}`
    );
  }
  static async getLatestReadings(count: number = 10) {
    return await Backend.get(`entries/sgv.json?count=${count}`);
  }
}

export default RemoteReadings;
