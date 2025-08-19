import { getHourDiff } from "../../lib/timing";
import Snapshot from "../snapshot";
import type { Deserializer, Serializer } from "../types/types";

export default class Activity {
  snapshot: Snapshot = new Snapshot();
  constructor() {}

  get timestamp(): Date {
    const readings = this.snapshot.initialBG;
    if (!readings)
      throw new Error(`Cannot get timestamp: failed to get finalBG`);
    return readings.timestamp;
  }
  get endTimestamp(): Date {
    const readings = this.snapshot.finalBG;
    if (!readings)
      throw new Error(`Cannot get end timestamp: failed to get finalBG`);
    return readings.timestamp;
  }

  get length() {
    // Returns the length (in hours) of the activity
    return getHourDiff(this.endTimestamp, this.timestamp);
  }

  set initialBG(val: number) {
    this.snapshot.initialBG = val;
  }
  get initialBG(): number | null {
    const reading = this.snapshot.initialBG;
    if (!reading) return null;
    return reading.sugar;
  }
  get started(): boolean {
    return this.initialBG !== null;
  }

  set finalBG(val: number) {
    this.snapshot.finalBG = val;
  }
  get finalBG(): number | null {
    const reading = this.snapshot.finalBG;
    if (!reading) return null;
    return reading.sugar;
  }

  get deltaBG(): number {
    const initialBG = this.initialBG;
    const finalBG = this.finalBG;
    if (!initialBG || !finalBG)
      throw new Error(`Cannot find deltaBG: no initial or final glucose`);
    return finalBG - initialBG;
  }

  static serialize: Serializer<Activity> = (a) => {
    return {
      snapshot: Snapshot.serialize(a.snapshot),
    };
  };
  static deserialize: Deserializer<Activity> = (o) => {
    const a = new Activity();
    a.snapshot = Snapshot.deserialize(o.snapshot);
    return a;
  };
}
