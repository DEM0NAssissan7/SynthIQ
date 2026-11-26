import { StreamManager } from "./streamManager";
import { EntryStore } from "../storage/entryStore";
import { Activity } from "../models/events/activity";
import { getMinuteDiff, getTimestampFromOffset } from "../lib/timing";
import { ActivitySession } from "../models/types/activitySession";
import { convertDimensions, MathUtil } from "../lib/util";
import Unit from "../models/unit";
import type { Template } from "../models/types/interfaces";

export namespace ActivityManager {
  // Fundamental
  export function getActivitySession(activity: Activity) {
    const stream = StreamManager.getStream();
    const subStream = stream.view(
      activity.timestamp,
      getTimestampFromOffset(
        activity.timestamp,
        activity.value * convertDimensions(Unit.Time.Minute, Unit.Time.Hour),
      ),
    );
    return new ActivitySession(subStream.snapshot, subStream.rescues, activity);
  }
  export function getActivitySessions() {
    const stream = StreamManager.getStream();
    const activities = stream.activities;

    const activitySessions: ActivitySession[] = [];
    for (const activity of activities)
      activitySessions.push(getActivitySession(activity));
    return activitySessions;
  }

  // Query
  export function queryActivities(name: string) {
    return getActivitySessions().filter((a) => a.name === name);
  }
  export function isFirstTime(name: string) {
    return queryActivities(name).length === 0;
  }
  export function getChangeRate(name: string) {
    return MathUtil.median(queryActivities(name).map((a) => a.changeRate));
  }
  export function getScore(name: string) {
    return MathUtil.median(queryActivities(name).map((a) => a.score));
  }
  export function getLength(name: string) {
    return MathUtil.median(queryActivities(name).map((a) => a.length));
  }

  // Helpers
  export function getTemplates(): Template[] {
    const activities: ActivitySession[] = getActivitySessions();
    const map = new Map();
    for (const item of activities) {
      const key = item.name;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(item);
    }
    const sortedActivities = Array.from(map.values());

    const templates: Template[] = [];
    for (const activities of sortedActivities) {
      const name = activities[0].name;
      const template: Template = {
        name: name,
        timestamp: activities.reduce(
          (t: Date, a: ActivitySession) =>
            a.timestamp.getTime() > t.getTime() ? a : t,
          new Date(0),
        ),
        score: getScore(name),
        size: queryActivities(name).length,
      };
      templates.push(template);
    }
    return templates;
  }
  export function getTemplate(name: string): Template | null {
    const template = getTemplates().find((a) => a.name === name);
    return template ?? null;
  }

  // Execution
  export function select(name: string) {
    EntryStore.activityName.value = name;
  }
  export function begin(
    name: string = EntryStore.activityName.value,
    timestamp = new Date(),
  ) {
    EntryStore.activity.value = new Activity(name, timestamp, 0);
    EntryStore.activityIsActive.value = true;
  }
  export function cancel() {
    EntryStore.activityIsActive.value = false;
  }
  export function end(timestamp = new Date()) {
    const activity = EntryStore.activity.value;
    const minutes = getMinuteDiff(timestamp, activity.timestamp);
    StreamManager.markActivity(minutes, activity.timestamp, activity.name);
    EntryStore.activityIsActive.value = false;
  }
}
