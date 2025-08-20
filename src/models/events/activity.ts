import { getMinuteDiff } from "../../lib/timing";
import { CalibrationStore } from "../../storage/calibrationStore";
import Snapshot from "../snapshot";
import type { Deserializer, JSONObject, Serializer } from "../types/types";
import Glucose from "./glucose";
import MetaEvent from "./metaEvent";

export default class Activity extends MetaEvent {
  snapshot: Snapshot = new Snapshot();
  glucoses: Glucose[] = [];
  glucoseEffect: number = CalibrationStore.glucoseEffect.value;
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

  // Subevents
  addGlucose(glucose: Glucose) {
    this.addChildSubscribable(glucose);
    this.glucoses.push(glucose);
    this.notify();
  }

  static serialize: Serializer<Activity> = (a) => {
    return {
      snapshot: Snapshot.serialize(a.snapshot),
      name: a.name,
      glucoses: a.glucoses.map((g) => Glucose.serialize(g)),
      glucoseEffect: a.glucoseEffect,
    };
  };
  static deserialize: Deserializer<Activity> = (o) => {
    const activity = new Activity(o.name);
    activity.snapshot = Snapshot.deserialize(o.snapshot);
    if (o.glucoses) {
      o.glucose.forEach((g: JSONObject) =>
        activity.addGlucose(Glucose.deserialize(g))
      );
      activity.glucoseEffect = o.glucoseEffect;
    }
    return activity;
  };
}
