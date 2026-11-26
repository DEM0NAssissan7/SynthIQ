import { Activity } from "./events/activity";
import Glucose from "./events/glucose";
import Insulin, { InjectionPurpose } from "./events/insulin";
import Meal from "./events/meal";
import type MetaEvent from "./events/metaEvent";
import Snapshot from "./snapshot";
import Subscribable from "./subscribable";
import SugarReading from "./types/sugarReading";
import type { Deserializer, Serializer } from "./types/types";

export class Stream extends Subscribable {
  constructor(
    public snapshot: Snapshot,
    public events: MetaEvent[] = [],
  ) {
    super();
    this.sortEvents();
    this.addChildSubscribable(snapshot);
    this.addChildSubscribable(...events);
  }

  // Unified timestamp system
  get beginning(): Date {
    if (this.events.length === 0 && this.snapshot.isEmpty)
      throw new Error(
        `Cannot get stream beginning: no readings or events present`,
      );
    const snapshotStartTime = !this.snapshot.isEmpty
      ? this.snapshot.startTime
      : null;
    this.sortEvents();
    const eventStartTime =
      this.events.length > 0 ? this.events[0].timestamp : null;
    if (!eventStartTime && snapshotStartTime) return snapshotStartTime;
    if (eventStartTime && !snapshotStartTime) return eventStartTime;
    if (!eventStartTime || !snapshotStartTime) throw new Error(`Unknown error`);

    return eventStartTime.getTime() < snapshotStartTime.getTime()
      ? eventStartTime
      : snapshotStartTime;
  }
  get end(): Date {
    if (this.events.length === 0 && this.snapshot.isEmpty)
      throw new Error(`Cannot get stream end: no readings or events present`);
    const snapshotStartTime = !this.snapshot.isEmpty
      ? this.snapshot.endTime
      : null;
    this.sortEvents();
    const eventStartTime =
      this.events.length > 0
        ? this.events[this.events.length - 1].timestamp
        : null;
    if (!eventStartTime && snapshotStartTime) return snapshotStartTime;
    if (eventStartTime && !snapshotStartTime) return eventStartTime;
    if (!eventStartTime || !snapshotStartTime) throw new Error(`Unknown error`);

    return eventStartTime.getTime() > snapshotStartTime.getTime()
      ? eventStartTime
      : snapshotStartTime;
  }

  // Abstractions
  private ofType<T extends MetaEvent>(
    ctor: abstract new (...args: any[]) => T,
  ): T[] {
    return this.events.filter((e): e is T => e instanceof ctor);
  }
  get allInsulins() {
    return this.ofType(Insulin);
  }
  get insulins() {
    return this.allInsulins.filter((i) => i.purpose !== InjectionPurpose.Basal);
  }
  get rescues() {
    return this.ofType(Glucose);
  }
  get meals() {
    return this.ofType(Meal);
  }
  get activities() {
    return this.ofType(Activity);
  }
  get basals() {
    return this.allInsulins.filter((i) => i.purpose === InjectionPurpose.Basal);
  }

  // Event management
  sortEvents() {
    this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  findDuplicate(event: MetaEvent) {
    const uuid = event.uuid;
    const time = event.timestamp.getTime();
    const constr = event.constructor;
    const existing = this.events.find(
      (r) =>
        r.uuid === uuid ||
        (r.timestamp.getTime() === time && r.constructor === constr),
    );
    return existing ?? null;
  }
  indexOf(event: MetaEvent) {
    for (let i = 0; i < this.events.length; i++)
      if (this.events[i].uuid === event.uuid) return i;
    return -1;
  }
  getEventByTimestamp(timestamp: Date) {
    const time = timestamp.getTime();
    for (const event of this.events)
      if (event.timestamp.getTime() === time) return event;
    return null;
  }
  push(...incoming: MetaEvent[]) {
    for (const e of incoming) {
      const existing = this.findDuplicate(e); // same type + same timestamp
      if (!existing) {
        this.events.push(e);
        this.addChildSubscribable(e);
        continue;
      }
      if (
        existing instanceof Insulin &&
        e instanceof Insulin &&
        existing.purpose === InjectionPurpose.Nominal
      ) {
        existing.purpose = e.purpose; // a tag beats no tag
      }
    }
    this.notify();
  }
  modify(event: MetaEvent) {
    const duplicate = this.findDuplicate(event);
    if (duplicate === null) {
      // Silently push because there is no duplicate event
      this.push(event);
      return;
    }
    const index = this.indexOf(duplicate);
    if (index === -1) return;
    this.events[index] = event;
    this.addChildSubscribable(event);
    this.removeChildSubscribable(duplicate);
    this.notify();
  }
  remove(event: MetaEvent) {
    const duplicate = this.findDuplicate(event);
    if (duplicate === null) return false;
    const index = this.indexOf(duplicate);
    if (index === -1) return false;
    this.events.splice(index, 1);
    this.removeChildSubscribable(duplicate);
    this.notify();
    return true;
  }

  // Event helpers
  get isEmpty() {
    return this.snapshot.isEmpty || this.events.length === 0;
  }

  // Snapshot wrappers
  addReadings = (...r: SugarReading[]) => this.snapshot.addReadings(...r);

  view(timestampA: Date, timestampB: Date, inclusive = false): Stream {
    const timeA = timestampA.getTime();
    const timeB = timestampB.getTime();
    const snapshot = this.snapshot.view(timestampA, timestampB);
    const events = this.events.filter((e: MetaEvent) => {
      const time = e.timestamp.getTime();
      if (time < timeA) return false;
      if (inclusive ? time > timeB : time >= timeB) return false;
      return true;
    });
    return new Stream(snapshot, events);
  }

  // Serialization
  static serialize: Serializer<Stream> = (s: Stream) => {
    return {
      snapshot: Snapshot.serialize(s.snapshot),
      insulins: s.allInsulins.map((a) => Insulin.serialize(a)),
      rescues: s.rescues.map((a) => Glucose.serialize(a)),
      meals: s.meals.map((a) => Meal.serialize(a)),
      activities: s.activities.map((a) => Activity.serialize(a)),
    };
  };
  static deserialize: Deserializer<Stream> = (o) => {
    const snapshot = Snapshot.deserialize(o.snapshot);
    const insulins = o.insulins.map((a: any) => Insulin.deserialize(a));
    const rescues = o.rescues.map((a: any) => Glucose.deserialize(a));
    const meals = o.meals.map((a: any) => Meal.deserialize(a));
    const activities = o.activities.map((a: any) => Activity.deserialize(a));
    return new Stream(snapshot, [
      ...insulins,
      ...rescues,
      ...meals,
      ...activities,
    ]);
  };
}
