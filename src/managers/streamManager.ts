/**
 * This manages the static data
 * Basically, this contains the master data behind everything. Every meal, every glucose treatment, every insulin, activity, etc.
 * The plan is this: We extract out the actual sessions & fasting information directly from this stream
 *
 * The stream is important because it allows for things outside of sessions to be handled. Architecturally, it is also a lot cleaner and more stable
 */

import RemoteReadings from "../lib/remote/readings";
import RemoteTreatments, {
  glucoseEventType,
  insulinEventType,
} from "../lib/remote/treatments";
import { getMinuteDiff } from "../lib/timing";
import { genUUID } from "../lib/util";
import Glucose from "../models/events/glucose";
import Insulin, { InjectionPurpose } from "../models/events/insulin";
import Meal from "../models/events/meal";
import type MetaEvent from "../models/events/metaEvent";
import Session from "../models/session";
import Snapshot from "../models/snapshot";
import { getReadingFromNightscout } from "../models/types/sugarReading";
import { PrivateStore } from "../storage/privateStore";
import { StreamStore } from "../storage/streamStore";
import { InsulinVariantManager } from "./insulinVariantManager";
import { RescueVariantManager } from "./rescueVariantManager";

export namespace StreamManager {
  export async function populateFromRemote() {
    const lastSyncTime = StreamStore.lastRemoteSyncTime.value;
    console.log(lastSyncTime);
    const now = new Date();

    // Readings
    const snapshot = new Snapshot();
    try {
      const remoteReadings = await RemoteReadings.getReadings(
        lastSyncTime,
        now,
      );
      const rawReadings = remoteReadings
        .filter((r) => r && (r.sgv != null || r.mbg != null))
        .map((r) => getReadingFromNightscout(r))
        .filter((r) => !isNaN(r.sugar) && !isNaN(r.timestamp.getTime()));
      if (PrivateStore.debugLogs.value) console.log(rawReadings);
      snapshot.addReadings(...rawReadings);
      snapshot.deduplicate();
    } catch (e) {
      if (PrivateStore.debugLogs.value) {
        console.error("Stream cloud pull error:", e);
      }
    }

    // Treatments
    const allTreatments = await RemoteTreatments.getTreatments(
      lastSyncTime,
      now,
    );
    const insulins: Insulin[] = [];
    const rescues: Glucose[] = [];
    for (const treatment of allTreatments) {
      if (!treatment.timestamp) continue;
      switch (treatment.eventType) {
        case insulinEventType:
          if (
            typeof treatment.insulin !== "number" ||
            !treatment.insulin ||
            Number.isNaN(treatment.insulin)
          )
            break;
          insulins.push(
            new Insulin(
              treatment.insulin,
              treatment.timestamp,
              InsulinVariantManager.getVariant(treatment.notes),
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
  }
  export function storeSession(s: Session, serialize = true) {
    if (s.meal) s.meal.uuid = s.uuid > 65536 ? s.uuid : genUUID();
    const stream = StreamStore.stream.value;
    stream.snapshot.absorb(s.snapshot);
    if (s.insulins.length > 0) {
      const insulin = s.insulins[0];
      if (s.meal && insulin.timestamp.getTime() < s.mealTimestamp.getTime()) {
        insulin.purpose = InjectionPurpose.PreBolus;
      }
    }
    stream.push(
      ...s.insulins,
      ...s.glucoses,
      ...s.activities,
      ...(s.meal !== null ? [s.meal] : []),
    );
    if (serialize) StreamStore.stream.write();
  }

  let sessionsCache: Session[] = [];
  StreamStore.stream.subscribe(() => (sessionsCache = [])); // Invalidate sessions cache upon any modification
  export function getSessions() {
    if (sessionsCache.length === 0) buildSessionsCache();
    return sessionsCache;
  }
  function buildSessionsCache(
    sinceTimestamp: Date | null = null,
    untilTimestamp: Date | null = null,
  ) {
    const masterStream =
      sinceTimestamp === null && untilTimestamp === null
        ? StreamStore.stream.value
        : StreamStore.stream.value.view(
            sinceTimestamp ?? StreamStore.stream.value.beginning,
            untilTimestamp ?? new Date(),
          );
    if (masterStream.isEmpty) return null;
    masterStream.sortEvents();
    const meals = masterStream.meals;

    sessionsCache = [];
    for (let index = 0; index < masterStream.events.length; index++) {
      const event = masterStream.events[index];
      if (
        !(
          event instanceof Meal ||
          (event instanceof Insulin &&
            event.purpose === InjectionPurpose.PreBolus)
        )
      )
        continue;
      const startTimestamp = event.timestamp;
      const meal = masterStream.events
        .slice(index)
        .find((e) => e instanceof Meal);
      if (!meal) continue;

      // Now we need to find the next non-merged meal
      const mealIndex = meals.indexOf(meal);
      const futureMeals = meals.slice(mealIndex + 1);
      const nextMeal =
        futureMeals.find(
          (m) => getMinuteDiff(m.timestamp, meal.timestamp) > 30,
        ) ?? null;
      const nextPrebolus = masterStream.events
        .slice(index)
        .find(
          (e) =>
            e.timestamp.getTime() > event.timestamp.getTime() &&
            e instanceof Insulin &&
            e.purpose === InjectionPurpose.PreBolus,
        );

      // Assume the session ends at the next meal or the latest event in the stream
      const fallbackEndTimestamp =
        masterStream.events[masterStream.events.length - 1].timestamp;
      let endTimestamp: Date =
        nextMeal && nextPrebolus
          ? new Date(
              Math.min(
                nextMeal.timestamp.getTime(),
                nextPrebolus.timestamp.getTime(),
              ),
            )
          : nextMeal
            ? nextMeal.timestamp
            : nextPrebolus
              ? nextPrebolus.timestamp
              : fallbackEndTimestamp;
      // Assume that it is finished if we have a next, and not otherwise
      let isFinished = nextMeal !== null;

      // Now we view the stream so that it only includes the information that is definitely relevant and we determine when the session ends
      const candidateStream = masterStream.view(
        startTimestamp,
        endTimestamp,
        nextMeal ? false : true,
      );
      if (candidateStream.isEmpty) continue;
      candidateStream.sortEvents();
      const firstInsulin = candidateStream.insulins.find(
        (i) => i.timestamp.getTime() >= startTimestamp.getTime(),
      );
      const fullSwingTime = Math.max(
        meal.timestamp.getTime(),
        firstInsulin?.timestamp.getTime() ?? meal.timestamp.getTime(),
      );
      const setEnd = (event: MetaEvent) => {
        endTimestamp = event.timestamp;
        isFinished = true;
      };
      for (const event of candidateStream.events) {
        const eventTime = event.timestamp.getTime();
        // If we have not gone into full swing (i.e. meal and insulin have not been taken) we don't do anything
        if (eventTime <= fullSwingTime) continue;

        // Now we craft a causally masked substream
        const subStream = candidateStream.view(startTimestamp, event.timestamp);

        // If this is a prebolus, we don't go any further
        if (event instanceof Insulin) {
          if (event.purpose === InjectionPurpose.PreBolus) {
            setEnd(event);
            break;
          }
        }

        // If we have no insulin at this point
        const isFasting = !subStream.insulins.reduce(
          (n, i) => i.getActivityStatus(event.timestamp) || n,
          false,
        );
        if (isFasting) {
          /**
           * So, the rationale here is that if any treatment is done after fasting is completed,
           * we can assume that the user doing another treatment is probably not doing it because
           * of the meal. It is likely some other benign thing that would be session noise.
           *  */
          if (!(event instanceof Insulin)) {
            setEnd(event);
            break;
          }
        }
      }

      // Now we assemble the session using the substream
      const subStream = masterStream.view(startTimestamp, endTimestamp);
      if (subStream.isEmpty) continue;
      // We reduce all the meals in the substream
      const compositeMeal = new Meal(
        meal.timestamp,
        meal.name,
        meal.templateUUID,
        meal.uuid,
      );
      subStream.meals.forEach((m) => compositeMeal.absorb(m));
      // Now we put together our session
      const session = new Session();
      session.meal = compositeMeal;
      session.insulins = subStream.insulins;
      session.glucoses = subStream.rescues;
      session.activities = subStream.activities;
      session.snapshot = subStream.snapshot;
      session.completed = isFinished;
      session.isGarbage = subStream.meals.some((m) => m.isGarbage);
      session.uuid = compositeMeal.uuid;
      sessionsCache.push(session);

      // Now we progress the forward pass and skip what we've already looked at
      // if (!isFinished) break;
      const endEvent = masterStream.getEventByTimestamp(endTimestamp);
      if (endEvent) {
        const newIndex = masterStream.indexOf(endEvent);
        if (newIndex !== -1) index = newIndex - 1;
      }
    }
  }
}
