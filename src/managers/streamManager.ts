/**
 * This manages the static data
 * Basically, this contains the master data behind everything. Every meal, every glucose treatment, every insulin, activity, etc.
 * The plan is this: We extract out the actual sessions & fasting information directly from this stream
 *
 * The stream is important because it allows for things outside of sessions to be handled. Architecturally, it is also a lot cleaner and more stable
 */

import RemoteReadings from "../lib/remote/readings";
import RemoteTreatments, {
  basalEventType,
  getEventType,
  glucoseEventType,
  insulinEventType,
} from "../lib/remote/treatments";
import { getHourDiff } from "../lib/timing";
import { Activity } from "../models/events/activity";
import Glucose from "../models/events/glucose";
import Insulin, { InjectionPurpose } from "../models/events/insulin";
import Meal from "../models/events/meal";
import MetaEvent from "../models/events/metaEvent";
import type Food from "../models/food";
import Snapshot, { reducePrecision } from "../models/snapshot";
import { Stream } from "../models/stream";
import type { InsulinVariant } from "../models/types/insulinVariant";
import type { RescueVariant } from "../models/types/rescueVariant";
import SugarReading, {
  getReadingFromNightscout,
  ReadingType,
} from "../models/types/sugarReading";
import type { UUID } from "../models/types/types";
import { PrivateStore } from "../storage/privateStore";
import { StreamStore } from "../storage/streamStore";
import { InsulinVariantManager } from "./insulinVariantManager";
import { RescueVariantManager } from "./rescueVariantManager";

/**
 * Storage is split in two (a log-structured layout): the main stream, written
 * in full only on compaction, and a small delta, written on every change. The
 * delta is everything that differs from the main stream as stored: events
 * added or changed, uuids removed, readings added or changed. It is derived
 * from that difference, never from timestamps, so no change can be missed
 * whatever its time (a backfilled reading, an edit to an old meal...).
 *
 * In memory there is one stream for the whole run: the main stream as
 * stored, with the delta replayed on top. It is never replaced, so everything
 * subscribed to it stays subscribed.
 */
const stream: Stream = StreamStore.streamMain.value;

function serializeEvent(e: MetaEvent): string {
  if (e instanceof Insulin) return JSON.stringify(Insulin.serialize(e));
  if (e instanceof Glucose) return JSON.stringify(Glucose.serialize(e));
  if (e instanceof Meal) return JSON.stringify(Meal.serialize(e));
  if (e instanceof Activity) return JSON.stringify(Activity.serialize(e));
  throw new Error(`Cannot serialize event: unknown type`);
}

/** The main stream as stored: what the delta is the difference from */
type Baseline = {
  events: Map<UUID, string>;
  readings: Map<number, SugarReading>;
};
function takeBaseline(): Baseline {
  stream.snapshot.deduplicate(); // One reading per instant, as stored
  return {
    events: new Map(stream.events.map((e) => [e.uuid, serializeEvent(e)])),
    readings: new Map(
      stream.snapshot.readings.map((r) => [
        r.timestamp.getTime(),
        new SugarReading(r.sugar, r.timestamp, r.type), // A copy: readings can be corrected in place
      ]),
    ),
  };
}

/** Apply the stored delta to the stream. Idempotent, so a delta that was already compacted changes nothing. */
function replayDelta() {
  const delta = StreamStore.streamDelta.value;
  for (const event of delta.events)
    if (!stream.modify(event)) stream.push(event);
  const removed = new Set(StreamStore.streamDeltaRemoved.value);
  for (const event of stream.events.filter((e) => removed.has(e.uuid)))
    stream.remove(event);
  stream.snapshot.upsert(delta.snapshot.readings);
}

let baseline = takeBaseline();
replayDelta();

/** Write the delta: everything that differs from the stored main stream */
function writeDelta() {
  stream.snapshot.deduplicate(); // As it would be stored
  const events = stream.events.filter(
    (e) => baseline.events.get(e.uuid) !== serializeEvent(e),
  );
  const present = new Set(stream.events.map((e) => e.uuid));
  const removed = [...baseline.events.keys()].filter((u) => !present.has(u));
  const snapshot = new Snapshot();
  for (const r of stream.snapshot.readings) {
    const stored = baseline.readings.get(r.timestamp.getTime());
    if (!stored || stored.sugar !== r.sugar || stored.type !== r.type)
      snapshot.addReadings(r);
  }
  // A storage copy: it must not subscribe to the live events
  StreamStore.streamDelta.value = new Stream(snapshot, events, false);
  StreamStore.streamDeltaRemoved.value = removed;
}
stream.subscribe(writeDelta);

export class StreamManager {
  static get stream() {
    return stream;
  }
}
export namespace StreamManager {
  /**
   * Pull every reading and treatment logged on Nightscout since the last sync
   * into the stream. At most one sync is in flight: overlapping syncs would
   * fetch the same window twice.
   */
  let syncInFlight: Promise<void> | null = null;
  export function populateFromRemote(): Promise<void> {
    if (syncInFlight) return syncInFlight;
    syncInFlight = sync().finally(() => (syncInFlight = null));
    return syncInFlight;
  }
  /**
   * Uploads reach Nightscout minutes after they are taken (up to ~8 seen), so
   * each sync reads back this far before the last one. Readings and treatments
   * read twice are merged with their copies, so the overlap changes nothing else.
   */
  const syncOverlapMinutes = 15;
  async function sync() {
    const lastSyncTime = new Date(
      StreamStore.lastRemoteSyncTime.value.getTime() -
        syncOverlapMinutes * 60 * 1000,
    );
    const now = new Date();

    // Readings
    const snapshot = new Snapshot();
    const insulins: Insulin[] = [];
    const rescues: Glucose[] = [];
    try {
      // Pull the relevant stuff from the remote
      // CGM and meter readings live at different endpoints: the CGM one
      // never returns fingersticks
      const remoteReadings = [
        ...(await RemoteReadings.getReadings(lastSyncTime, now)),
        ...(await RemoteReadings.getMeterReadings(lastSyncTime, now)),
      ];
      const allTreatments = await RemoteTreatments.getTreatments(
        lastSyncTime,
        now,
      );
      // If nothing was actually synchronized, we don't bother
      if (remoteReadings.length === 0 && allTreatments.length === 0) {
        return;
      }

      const rawReadings = remoteReadings
        .filter((r) => r && (r.sgv != null || r.mbg != null))
        .map((r) => getReadingFromNightscout(r))
        .filter((r) => !isNaN(r.sugar) && !isNaN(r.timestamp.getTime()));
      if (PrivateStore.debugLogs.value) console.log(rawReadings);
      // One at a time: spreading a full resync overflows the call stack
      for (const reading of rawReadings) snapshot.addReadings(reading);
      snapshot.deduplicate();

      // Treatments
      for (const treatment of allTreatments) {
        if (!treatment.timestamp) continue;
        switch (treatment.eventType) {
          case insulinEventType:
          case basalEventType:
          case "Basal Insulin":
            if (
              typeof treatment.insulin !== "number" ||
              !treatment.insulin ||
              Number.isNaN(treatment.insulin)
            )
              break;
            const isBasal =
              treatment.eventType === basalEventType ||
              treatment.eventType === "Basal Insulin";
            insulins.push(
              new Insulin(
                treatment.insulin,
                treatment.timestamp,
                InsulinVariantManager.getVariant(treatment.notes),
                !isBasal ? InjectionPurpose.Nominal : InjectionPurpose.Basal,
              ),
            );
            break;
          case glucoseEventType:
            if (!treatment.carbs || Number.isNaN(treatment.carbs)) break;
            const variant = RescueVariantManager.getVariant(treatment.notes);
            rescues.push(
              new Glucose(
                treatment.carbs / variant.carbs,
                treatment.timestamp,
                variant,
              ),
            );
            break;
        }
      }

      stream.snapshot.absorb(snapshot);
      stream.push(...insulins, ...rescues);
      StreamStore.lastRemoteSyncTime.value = now;
    } catch (e) {
      if (PrivateStore.debugLogs.value) {
        console.error("Stream cloud pull error:", e);
      }
    }
  }

  // Log write managemnt
  /** Compact if the schedule says it is due */
  export function syncDelta() {
    const now = new Date();
    const syncHours = StreamStore.syncHoursSchedule.value;
    const lastSyncTimestamp = StreamStore.lastDeltaSyncTimestamp.value;
    if (getHourDiff(now, lastSyncTimestamp) < syncHours) return; // Don't sync too early
    compact();
  }
  /**
   * Write the whole stream as the main stream, then clear the delta. Main is
   * written first: a crash in between leaves the old delta, which replays
   * onto the new main as a no-op.
   */
  export function compact() {
    StreamStore.streamMain.write(); // The stream is the main stream's value
    baseline = takeBaseline();
    StreamStore.streamDelta.value = new Stream();
    StreamStore.streamDeltaRemoved.value = [];
    StreamStore.lastDeltaSyncTimestamp.value = new Date();
  }

  // Event Management
  export function modify(event: MetaEvent) {
    return stream.modify(event);
  }
  export function remove(event: MetaEvent) {
    const removed = stream.remove(event);
    if (!removed) return false;
    const eventType = getEventType(event);
    if (eventType) RemoteTreatments.removeTreatment(eventType, event.timestamp);
    return removed;
  }

  // Marking
  /**
   * The blood sugar the user entered for an action (a meal, dose, rescue...),
   * recorded as their blood sugar at `timestamp`, the action's time. Only a
   * manual entry is a new reading: a CGM or meter value came from Nightscout
   * and is in the stream already.
   */
  export function markReading(reading: SugarReading | null, timestamp: Date) {
    if (!reading || reading.type !== ReadingType.Manual) return;
    const time = reducePrecision(timestamp.getTime()); // As the snapshot stores it
    const recorded = stream.snapshot.readings.some(
      (r) => r.type === ReadingType.Manual && r.timestamp.getTime() === time,
    );
    if (!recorded)
      stream.addReadings(
        new SugarReading(reading.sugar, timestamp, ReadingType.Manual),
      );
  }
  export function markInsulin(
    units: number,
    timestamp: Date,
    variant: InsulinVariant,
    purpose: InjectionPurpose,
  ) {
    const insulin = new Insulin(units, timestamp, variant, purpose);
    RemoteTreatments.markInsulin(units, timestamp, variant.name, purpose);
    stream.push(insulin);
  }
  export function markBasal(units: number, timestamp: Date) {
    const variant = InsulinVariantManager.getBasalVariant();
    const insulin = new Insulin(
      units,
      timestamp,
      variant,
      InjectionPurpose.Basal,
    );
    RemoteTreatments.markBasal(units, timestamp);
    stream.push(insulin);
  }
  export function markMeal(
    foods: Food[],
    timestamp: Date,
    name: string,
    templateUUID: UUID | null,
    isGarbage: boolean,
  ) {
    const meal = new Meal(timestamp, name, templateUUID);
    meal.foods = foods;
    meal.isGarbage = isGarbage;
    RemoteTreatments.markMeal(
      meal.name,
      meal.carbs,
      meal.protein,
      meal.timestamp,
    );
    stream.push(meal);
  }
  export function markRescue(
    value: number,
    timestamp: Date,
    variant: RescueVariant,
  ) {
    const rescue = new Glucose(value, timestamp, variant);
    RemoteTreatments.markGlucose(
      value * variant.carbs,
      timestamp,
      variant.name,
    );
    stream.push(rescue);
  }
  export function markActivity(
    durationMinutes: number,
    timestamp: Date,
    name: string,
  ) {
    const activity = new Activity(name, timestamp, durationMinutes);
    RemoteTreatments.markActivity(name, timestamp, durationMinutes);
    stream.push(activity);
  }
}
