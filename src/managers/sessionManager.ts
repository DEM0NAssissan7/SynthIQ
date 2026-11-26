import { getMinuteDiff } from "../lib/timing";
import Insulin, { InjectionPurpose } from "../models/events/insulin";
import Meal from "../models/events/meal";
import type MetaEvent from "../models/events/metaEvent";
import Session from "../models/session";
import { StreamStore } from "../storage/streamStore";
import type { Template } from "../models/types/interfaces";
import type { UUID } from "../models/types/types";
import { MathUtil } from "../lib/util";
import {
  getBaseSessionFrom,
  getBaseSessionsFrom,
} from "../lib/helpers/getBaseSessions";

export namespace SessionManager {
  /** A meal within this many minutes of a session's meal is part of that session */
  export const mealMergeMinutes = 30;
  /** Name of meals logged without one (the "Skip naming" button). Their sessions are pooled with every other session. */
  export const unnamedMealName = "Session";

  let sessionsCache: Session[] = [];
  /** The stream meals each session was assembled from (its meal is their composite) */
  let sessionMeals = new Map<Session, Meal[]>();
  StreamStore.stream.subscribe(() => {
    // Invalidate sessions cache upon any modification
    sessionsCache = [];
    sessionMeals = new Map();
  });
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
    sessionMeals = new Map();
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
          (m) => getMinuteDiff(m.timestamp, meal.timestamp) > mealMergeMinutes,
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

        // Causal mask: only the insulin taken before this event
        const priorInsulins = candidateStream.insulins.filter(
          (i) =>
            i.timestamp.getTime() >= startTimestamp.getTime() &&
            i.timestamp.getTime() < eventTime,
        );

        // If this is a prebolus, we don't go any further
        if (event instanceof Insulin) {
          if (event.purpose === InjectionPurpose.PreBolus) {
            setEnd(event);
            break;
          }
        }

        // If we have no insulin at this point
        const isFasting = !priorInsulins.reduce(
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
      sessionMeals.set(session, subStream.meals);

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
  /**
   * The sessions dosing advice for meals named `name` is drawn from: their
   * own, or every session if there is no valid one of their own (or no name).
   */
  export function getPool(name: string) {
    if (name === unnamedMealName || querySessions(name).length === 0)
      return getSessions();
    return getAllSessionsByName(name);
  }
  export function isFirstTime(name: string) {
    return getPool(name).length === 0;
  }
  export function getLatestSession(name: string): Session | null {
    const sessions = querySessions(name);
    return sessions[sessions.length - 1] ?? null;
  }
  export function getScore(name: string) {
    return MathUtil.median(querySessions(name).map((s) => s.score));
  }
  /** The template UUID the meals named `name` were last logged with */
  export function getTemplateUUID(name: string): UUID | null {
    const sessions = getAllSessionsByName(name);
    return sessions[sessions.length - 1]?.meal.templateUUID ?? null;
  }
  /** Every past session of this same meal, or the single most similar one if there are none */
  export function getBaseSessions(meal: Meal, timestamp = new Date()) {
    return getBaseSessionsFrom(meal, getPool(meal.name), timestamp);
  }
  export function getBaseSession(meal: Meal, timestamp = new Date()) {
    return getBaseSessionFrom(meal, getPool(meal.name), timestamp);
  }

  // Live session
  /**
   * The session that is still running: the latest one, unless something has
   * already ended it. A bolus logged now becomes part of it.
   */
  export function getCurrentSession(): Session | null {
    const sessions = getSessions();
    const latest = sessions[sessions.length - 1];
    if (!latest || latest.completed) return null;
    return latest;
  }
  /**
   * Whether a meal logged at `timestamp` starts a new session, by the same
   * rules as the forward pass: it joins a pre-bolus that has no meal yet, or
   * the current session if it comes within `mealMergeMinutes` of its meal.
   */
  export function startsNewSession(timestamp = new Date()): boolean {
    const stream = StreamStore.stream.value;
    stream.sortEvents();
    const preboluses = stream.insulins.filter(
      (i) => i.purpose === InjectionPurpose.PreBolus,
    );
    const lastPrebolus = preboluses[preboluses.length - 1];
    if (
      lastPrebolus &&
      !stream.meals.some(
        (m) => m.timestamp.getTime() >= lastPrebolus.timestamp.getTime(),
      )
    )
      return false;
    const current = getCurrentSession();
    if (!current) return true;
    return getMinuteDiff(timestamp, current.meal.timestamp) > mealMergeMinutes;
  }

  /**
   * Whether the user is fasting at `timestamp`, as the forward pass sees it:
   * no insulin of the current session is still active. Anything but insulin
   * logged while fasting ends the session.
   */
  export function isFasting(timestamp = new Date()): boolean {
    const current = getCurrentSession();
    if (!current) return true;
    return !current.insulins.some((i) => i.getActivityStatus(timestamp));
  }

  // Editing
  /** The stream meals a session was assembled from */
  export function getMeals(session: Session): Meal[] {
    return sessionMeals.get(session) ?? [];
  }
  /** Mark (or unmark) a session as garbage: a session is garbage if any of its meals is */
  export function setGarbage(session: Session, isGarbage: boolean) {
    for (const meal of getMeals(session)) meal.isGarbage = isGarbage;
    StreamStore.stream.write();
  }

  // Helpers
  export function getTemplates(): Template[] {
    const sessions: Session[] = getSessions();
    const map = new Map<string, Session[]>();
    for (const item of sessions) {
      const key = item.meal.name;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    const sortedSessions = Array.from(map.values());

    const templates: Template[] = [];
    for (const sessions of sortedSessions) {
      const name = sessions[0].meal.name;
      const template: Template = {
        name: name,
        timestamp: sessions.reduce(
          (t: Date, s: Session) =>
            s.timestamp.getTime() > t.getTime() ? s.timestamp : t,
          new Date(0),
        ),
        score: getScore(name),
        size: getAllSessionsByName(name).length,
      };
      templates.push(template);
    }
    return templates;
  }
  export function getTemplate(name: string): Template | null {
    const template = getTemplates().find((a) => a.name === name);
    return template ?? null;
  }
}
