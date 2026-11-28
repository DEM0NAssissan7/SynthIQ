import { Activity } from "./events/activity";
import Glucose from "./events/glucose";
import Insulin, { InjectionPurpose } from "./events/insulin";
import Meal from "./events/meal";
import type MetaEvent from "./events/metaEvent";
import Snapshot from "./snapshot";
import Subscribable from "./subscribable";
import SugarReading from "./types/sugarReading";
import type { Deserializer, Serializer } from "./types/types";
import { firstIndexWhere } from "../lib/util";

/** An event with no valid timestamp cannot be placed in the stream (and would break its ordering) */
const isPlaceable = (e: MetaEvent) => !Number.isNaN(e.timestamp.getTime());

export class Stream extends Subscribable {
  /**
   * @param subscribe Notify on changes to the snapshot and events. Only the
   * stream that owns its events subscribes to them: a view borrows the owner's
   * events, and subscribing to them would keep every view alive for as long as
   * the events live.
   */
  eventsAreSorted = false;
  constructor(
    public snapshot: Snapshot = new Snapshot(),
    public events: MetaEvent[] = [],
    subscribe = true,
  ) {
    super();
    this.events = events.filter(isPlaceable);
    this.sortEvents();
    if (!subscribe) return;
    this.subscribe(() => (this.eventsAreSorted = false));
    this.addChildSubscribable(snapshot);
    this.addChildSubscribable(...this.events);
  }
  absorb(...streams: Stream[]) {
    const snapshot = new Snapshot();
    const events: MetaEvent[] = [];
    streams.forEach((stream) => {
      snapshot.absorb(stream.snapshot);
      events.push(...stream.events);
    });
    this.snapshot.absorb(snapshot);
    this.push(...events);
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
    this.sortEvents(); // Callers take the latest from the end
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
    if (this.eventsAreSorted) return;
    this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.eventsAreSorted = true;
  }
  findDuplicate(event: MetaEvent) {
    const uuid = event.uuid;
    const time = event.timestamp.getTime();
    const constr = event.constructor;
    const existing = this.events.find(
      (e) =>
        e.uuid === uuid ||
        (e.timestamp.getTime() === time && e.constructor === constr),
    );
    return existing ?? null;
  }
  contains(event: MetaEvent) {
    const duplicate = this.findDuplicate(event);
    return duplicate === null ? false : true;
  }
  indexOf(event: MetaEvent) {
    for (let i = 0; i < this.events.length; i++)
      if (this.events[i].uuid === event.uuid) return i;
    return -1;
  }
  push(...incoming: MetaEvent[]) {
    for (const e of incoming) {
      if (!isPlaceable(e)) continue;
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
    this.eventsAreSorted = false;
    this.notify();
  }
  modify(event: MetaEvent) {
    const duplicate = this.findDuplicate(event);
    if (duplicate === null) return false;
    const index = this.indexOf(duplicate);
    if (index === -1) return false;
    this.events[index] = event;
    this.addChildSubscribable(event);
    this.removeChildSubscribable(duplicate);
    this.eventsAreSorted = false;
    this.notify();
    return true;
  }
  remove(event: MetaEvent) {
    const duplicate = this.findDuplicate(event);
    if (duplicate === null) return false;
    const index = this.indexOf(duplicate);
    if (index === -1) return false;
    this.events.splice(index, 1);
    this.removeChildSubscribable(duplicate);
    this.notify();
    this.eventsAreSorted = false;
    return true;
  }

  // Event helpers
  get isEmpty() {
    return this.snapshot.isEmpty || this.events.length === 0;
  }

  // Snapshot wrappers
  addReadings = (...r: SugarReading[]) => this.snapshot.addReadings(...r);

  view(since: Date, until: Date | null = null, inclusive = false): Stream {
    const timeA = since.getTime();
    const timeB = until?.getTime() ?? null;
    const snapshot = this.snapshot.view(since, until);
    this.sortEvents();
    const events: MetaEvent[] = [];
    const start = firstIndexWhere(
      this.events,
      (e) => e.timestamp.getTime() >= timeA,
    );
    for (let i = start; i < this.events.length; i++) {
      const time = this.events[i].timestamp.getTime();
      if (timeB && (inclusive ? time > timeB : time >= timeB)) break;
      events.push(this.events[i]);
    }
    return new Stream(snapshot, events, false); // Read-only window: see constructor
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
