import MetaEvent from "./metaEvent";
import type { Deserializer, Serializer } from "../types/types";
import { getHourDiff } from "../../lib/timing";

export default class Activity extends MetaEvent {
  _endTimestamp: Date | null = null;
  set endTimestamp(value: Date | null) {
    this._endTimestamp = value;
    this.notify();
  }
  get endTimestamp(): Date | null {
    return this._endTimestamp;
  }

  get length() {
    if (!this.endTimestamp)
      throw new Error(`Cannot determine activity length: no end timestamp`);
    return getHourDiff(this.timestamp, this.endTimestamp);
  }

  constructor(startTimestamp: Date) {
    super(startTimestamp);
  }

  static serialize: Serializer<Activity> = (a: Activity) => {
    return {
      startTimestamp: a.timestamp.toString(),
      endTimestamp: a.endTimestamp?.toString() || null,
    };
  };
  static deserialize: Deserializer<Activity> = (o) => {
    const activity = new Activity(new Date(o.startTimestamp));
    activity.endTimestamp = o.endTimestamp ? new Date(o.endTimestamp) : null;
    return activity;
  };
}
