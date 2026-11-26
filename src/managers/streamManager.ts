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
  glucoseEventType,
  insulinEventType,
} from "../lib/remote/treatments";
import { Activity } from "../models/events/activity";
import Glucose from "../models/events/glucose";
import Insulin, { InjectionPurpose } from "../models/events/insulin";
import Meal from "../models/events/meal";
import MetaEvent from "../models/events/metaEvent";
import type Food from "../models/food";
import Snapshot, { reducePrecision } from "../models/snapshot";
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
  async function sync() {
    const lastSyncTime = StreamStore.lastRemoteSyncTime.value;
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

      const stream = StreamStore.stream.value;
      stream.snapshot.absorb(snapshot);
      stream.push(...insulins, ...rescues);
      StreamStore.stream.write();
      StreamStore.lastRemoteSyncTime.value = now;
    } catch (e) {
      if (PrivateStore.debugLogs.value) {
        console.error("Stream cloud pull error:", e);
      }
    }
  }

  export function getStream() {
    return StreamStore.stream.value;
  }

  // Event Management
  export function modify(event: MetaEvent) {
    return getStream().modify(event);
  }
  export function remove(event: MetaEvent) {
    return getStream().remove(event);
  }

  // Marking
  /**
   * A blood sugar the user entered. Only a manual entry is a new reading: a
   * CGM or meter value came from Nightscout and is in the stream already. The
   * same entry recorded twice (e.g. restored on another page) is kept once.
   */
  export function markReading(reading: SugarReading | null) {
    if (!reading || reading.type !== ReadingType.Manual) return;
    const time = reducePrecision(reading.timestamp.getTime()); // As the snapshot stores it
    const stream = getStream();
    const recorded = stream.snapshot.readings.some(
      (r) => r.type === ReadingType.Manual && r.timestamp.getTime() === time,
    );
    if (!recorded) stream.addReadings(reading);
  }
  export function markInsulin(
    units: number,
    timestamp: Date,
    variant: InsulinVariant,
    purpose: InjectionPurpose,
  ) {
    const insulin = new Insulin(units, timestamp, variant, purpose);
    RemoteTreatments.markInsulin(units, timestamp, variant.name, purpose);
    getStream().push(insulin);
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
    getStream().push(insulin);
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
    getStream().push(meal);
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
    getStream().push(rescue);
  }
  export function markActivity(
    durationMinutes: number,
    timestamp: Date,
    name: string,
  ) {
    const activity = new Activity(name, timestamp, durationMinutes);
    RemoteTreatments.markActivity(name, timestamp, durationMinutes);
    getStream().push(activity);
  }
}
