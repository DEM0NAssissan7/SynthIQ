import Activity from "./events/activity";
import type { Template } from "./types/interfaces";
import type { Deserializer, Serializer } from "./types/types";

export class ActivityTemplate implements Template {
  activities: Activity[] = [];
  constructor(public name: string) {}

  addActivity(activity: Activity) {
    this.activities.push(activity);
  }

  get isFirstTime(): boolean {
    return this.activities.length === 0;
  }
  get latestActivity(): Activity {
    if (this.isFirstTime)
      throw new Error(`Cannot get latest activity - no activities are stored`);
    return this.activities[this.activities.length - 1];
  }
  get timestamp(): Date {
    if (this.isFirstTime) return new Date();
    return this.latestActivity.timestamp;
  }
  get activity(): Activity {
    if (this.isFirstTime) return new Activity(this.name);
    return this.activities[this.activities.length - 1];
  }

  static serialize: Serializer<ActivityTemplate> = (t: ActivityTemplate) => {
    return {
      activities: t.activities.map((a) => Activity.serialize(a)),
      name: t.name,
    };
  };
  static deserialize: Deserializer<ActivityTemplate> = (o) => {
    const activityTemplate = new ActivityTemplate(o.name);
    o.activities.forEach((o: any) => {
      const activity = Activity.deserialize(o);
      activityTemplate.addActivity(activity);
    });
    return activityTemplate;
  };
}
