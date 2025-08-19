import { getMinuteDiff } from "../../lib/timing";
import Snapshot from "../snapshot";
import type { Deserializer, Serializer } from "../types/types";
import MetaEvent from "./metaEvent";

export default class Activity extends MetaEvent {
  snapshot: Snapshot = new Snapshot();
  constructor(public name: string) {
    super(new Date());
  }

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
    // Returns the length (in minutes) of the activity
    return getMinuteDiff(this.endTimestamp, this.timestamp);
  }

  set initialBG(val: number) {
    this.snapshot.initialBG = val;
    this.notify();
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
    this.notify();
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
      name: a.name,
    };
  };
  static deserialize: Deserializer<Activity> = (o) => {
    const a = new Activity(o.name);
    a.snapshot = Snapshot.deserialize(o.snapshot);
    return a;
  };
}
