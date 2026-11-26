import { MathUtil } from "../lib/util";
import type { ActivitySession } from "./types/activitySession";
import type { Template } from "./types/interfaces";
import type { Deserializer, Serializer } from "./types/types";

export class ActivityTemplate implements Template {
  activities: ActivitySession[] = [];
  constructor(public name: string) {}

  addActivity(activity: ActivitySession) {
    this.activities.push(activity);
  }

  get isFirstTime(): boolean {
    return this.activities.length === 0;
  }
  get latestActivity(): ActivitySession {
    if (this.isFirstTime)
      throw new Error(`Cannot get latest activity - no activities are stored`);
    return this.activities[this.activities.length - 1];
  }
  get timestamp(): Date {
    if (this.isFirstTime) return new Date();
    return this.latestActivity.timestamp;
  }
  get changeRate(): number {
    return MathUtil.median(this.activities.map((a) => a.changeRate));
  }
  get score(): number {
    return MathUtil.median(this.activities.map((a) => a.score));
  }
  get length(): number {
    return MathUtil.median(this.activities.map((a) => a.length));
  }
  get size(): number {
    return this.activities.length;
  }
}
