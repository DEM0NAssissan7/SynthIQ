import { getMinuteDiff } from "../lib/timing";
import Insulin, { InjectionPurpose } from "../models/events/insulin";
import Meal from "../models/events/meal";
import type MetaEvent from "../models/events/metaEvent";
import Session from "../models/session";
import { StreamStore } from "../storage/streamStore";

export namespace SessionManager {
  let sessionsCache: Session[] = [];
  StreamStore.stream.subscribe(() => (sessionsCache = [])); // Invalidate sessions cache upon any modification
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
      const session = new Session(
        compositeMeal,
        subStream.insulins,
        subStream.rescues,
        subStream.activities,
        subStream.snapshot,
        isFinished,
        subStream.meals.some((m) => m.isGarbage),
      );
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

  // Fundamentals
  export function getSessions() {
    if (sessionsCache.length === 0) buildSessionsCache();
    return sessionsCache.slice();
  }

  // Query (previously templates)
  export function getValidSessions() {
    return getSessions().filter((s) => !s.isInvalid);
  }
  export function getAllSessionsByName(name: string) {
    const sessions = getSessions();
    return sessions.filter((s) => s.meal.name === name);
  }
  export function querySessions(name: string) {
    return getAllSessionsByName(name).filter((s) => !s.isInvalid);
  }
}
