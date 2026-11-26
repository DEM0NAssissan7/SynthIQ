import { Activity } from "../../models/events/activity";
import Glucose from "../../models/events/glucose";
import Insulin, { InjectionPurpose } from "../../models/events/insulin";
import Meal from "../../models/events/meal";
import Snapshot, { reducePrecision } from "../../models/snapshot";
import SugarReading from "../../models/types/sugarReading";
import type { UUID } from "../../models/types/types";
import { getMinuteDiff } from "../../lib/timing";

/**
 * Legacy JSON shapes, as written by the pre-stream Session / MealTemplate
 * serializers. Fields are optional because the format changed over time.
 * Event payloads (meal, insulin, glucose, activity, snapshot) are left opaque
 * and handed to the current event deserializers, which are the stream's own
 * formats and keep their backwards compatibility.
 */
export interface LegacySessionJSON {
  uuid?: UUID;
  isGarbage?: boolean;
  snapshot?: unknown;
  snapshots?: unknown[]; // Very old format: several snapshots per session
  meal?: unknown;
  meals?: unknown[]; // Very old format: a list of meals
  insulins?: unknown[];
  glucoses?: unknown[];
  activities?: unknown[];
}
/**
 * Legacy activity (pre-stream `Activity`): it had no timestamp or duration of
 * its own. Both came from its snapshot: start = initial BG reading,
 * end = final BG reading.
 */
export interface LegacyActivityJSON {
  name?: string;
  uuid?: UUID;
  snapshot?: unknown;
  glucoses?: unknown[];
}
/** `synthiq.activity.templates` entry: the archive of every finished activity */
export interface LegacyActivityTemplateJSON {
  name?: string;
  activities?: LegacyActivityJSON[];
}
export interface LegacyTemplateJSON {
  name?: string;
  UUID?: UUID;
  sessions?: LegacySessionJSON[];
}

/** A legacy session converted to stream facts, before it is merged into the stream */
export interface LegacySessionData {
  /** Identity of the legacy session, used to skip copies of it found in other keys */
  key: string;
  meals: Meal[];
  insulins: Insulin[];
  glucoses: Glucose[];
  activities: Activity[];
  snapshot: Snapshot;
  /** Activities that were dropped because they had no readings (and therefore no start or end) */
  droppedActivities: number;
}

/** The template a session was filed under. Meals now carry this themselves. */
export interface TemplateInfo {
  name: string | null;
  UUID: UUID | null;
}

function isObject(o: unknown): o is Record<string, unknown> {
  return typeof o === "object" && o !== null && !Array.isArray(o);
}
export function asArray(o: unknown): unknown[] {
  return Array.isArray(o) ? o : [];
}

export function asTemplate(o: unknown): LegacyTemplateJSON | null {
  if (!isObject(o)) return null;
  return o as LegacyTemplateJSON;
}
export function asTemplates(o: unknown): LegacyTemplateJSON[] {
  return asArray(o)
    .map(asTemplate)
    .filter((t): t is LegacyTemplateJSON => t !== null);
}
export function asActivityTemplates(o: unknown): LegacyActivityTemplateJSON[] {
  return asArray(o).filter(isObject) as LegacyActivityTemplateJSON[];
}
export function asActivity(o: unknown): LegacyActivityJSON | null {
  if (!isObject(o)) return null;
  return o as LegacyActivityJSON;
}
export function asSession(o: unknown): LegacySessionJSON | null {
  if (!isObject(o)) return null;
  return o as LegacySessionJSON;
}

/**
 * Convert one legacy session into stream facts.
 *
 * Mirrors what the legacy Session.deserialize + MigrationManager did, minus the
 * Session object:
 * - Meals take the template's name / UUID and the session's garbage flag.
 *   Very old sessions with several meals were treated as garbage, so every one
 *   of those meals is kept but marked garbage.
 * - The first insulin is tagged PREBOLUS if it was taken before the meal.
 * - Activities are converted with convertLegacyActivity; ones without
 *   readings are dropped.
 */
export function convertLegacySession(
  o: LegacySessionJSON,
  template: TemplateInfo,
): LegacySessionData {
  const isGarbage = o.isGarbage ?? false;

  // Meals
  const rawMeals = o.meal ? [o.meal] : asArray(o.meals);
  const multipleMeals = !o.meal && rawMeals.length > 1;
  const meals = rawMeals.map((m) => {
    const meal = Meal.deserialize(m);
    if (!meal.name && template.name) meal.name = template.name;
    if (meal.templateUUID === null && template.UUID !== null)
      meal.templateUUID = template.UUID;
    meal.isGarbage = meal.isGarbage || isGarbage || multipleMeals;
    return meal;
  });

  // Treatments
  const insulins = asArray(o.insulins)
    .map((a) => Insulin.deserialize(a))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const glucoses = asArray(o.glucoses).map((a) => Glucose.deserialize(a));

  let droppedActivities = 0;
  const activities: Activity[] = [];
  const activityReadings: Snapshot[] = [];
  for (const a of asArray(o.activities)) {
    const converted = convertLegacyActivity(asActivity(a) ?? {});
    if (!converted) {
      droppedActivities++;
      continue;
    }
    activities.push(converted.activity);
    activityReadings.push(converted.snapshot);
  }

  // Pre-bolus: the session's first insulin, if it came before the meal
  const firstMeal = meals
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
  const firstInsulin = insulins[0];
  if (
    firstMeal &&
    firstInsulin &&
    firstInsulin.purpose === InjectionPurpose.Nominal &&
    firstInsulin.timestamp.getTime() < firstMeal.timestamp.getTime()
  )
    firstInsulin.purpose = InjectionPurpose.PreBolus;

  // Readings
  const snapshot = o.snapshot
    ? Snapshot.deserialize(o.snapshot)
    : new Snapshot();
  for (const s of asArray(o.snapshots))
    snapshot.absorb(Snapshot.deserialize(s));
  for (const s of activityReadings) snapshot.absorb(s);

  // Identity: legacy session UUIDs collided (16-bit generator), so pair the
  // UUID with the session's earliest event to tell sessions apart
  const times = [...meals, ...insulins, ...glucoses].map((e) =>
    e.timestamp.getTime(),
  );
  const earliest = times.length > 0 ? Math.min(...times) : null;
  const key = `${o.uuid ?? "?"}@${earliest ?? "empty"}`;

  return {
    key,
    meals,
    insulins,
    glucoses,
    activities,
    snapshot,
    droppedActivities,
  };
}

/**
 * Convert one legacy activity into a stream Activity event plus its readings.
 *
 * - timestamp = the snapshot's initial reading, duration = minutes until its
 *   final reading (the same minute rounding ActivityManager.end uses).
 * - The activity's own `glucoses` are NOT migrated. They were only ever added
 *   by WizardManager.markGlucose, which logged the same rescue (to the meal
 *   session and to Nightscout) under a separate `new Date()` taken a few ms
 *   apart, so migrating them would duplicate every rescue taken during an
 *   activity. The stream gets those rescues from the session / Nightscout,
 *   and an ActivitySession now picks up whatever rescues fall in its window.
 *
 * Returns null when the activity has no readings, so no start or end.
 */
export function convertLegacyActivity(
  o: LegacyActivityJSON,
): { activity: Activity; snapshot: Snapshot } | null {
  if (!o.snapshot) return null;
  const snapshot = Snapshot.deserialize(o.snapshot);
  const start = snapshot.initialBG;
  const end = snapshot.finalBG;
  if (!start || !end) return null;
  const activity = new Activity(
    o.name ?? "",
    start.timestamp,
    getMinuteDiff(end.timestamp, start.timestamp),
    o.uuid ?? null,
  );
  return { activity, snapshot };
}

/**
 * Activities from the activity archive (`synthiq.activity.templates`) as
 * session data with no meal. Every finished activity was archived there; only
 * the ones done during a started meal session were also copied into it.
 */
export function convertLegacyActivityArchive(
  templates: LegacyActivityTemplateJSON[],
): { data: LegacySessionData[]; dropped: number } {
  const data: LegacySessionData[] = [];
  let dropped = 0;
  for (const template of templates)
    for (const a of asArray(template.activities)) {
      const o = asActivity(a) ?? {};
      // Archive entries were filed under the template's name
      const converted = convertLegacyActivity({
        ...o,
        name: o.name || template.name,
      });
      if (!converted) {
        dropped++;
        continue;
      }
      const { activity, snapshot } = converted;
      data.push({
        key: `activity:${o.uuid ?? "?"}@${activity.timestamp.getTime()}`,
        meals: [],
        insulins: [],
        glucoses: [],
        activities: [activity],
        snapshot,
        droppedActivities: 0,
      });
    }
  return { data, dropped };
}

// ---------------------------------------------------------------------------
// Caches that duplicated the stream (healthMonitor, basal, cache, inbox)
// ---------------------------------------------------------------------------

/** Session data with no meal: the shape every non-session source converts to */
export function legacyFacts(
  key: string,
  facts: Partial<Omit<LegacySessionData, "key">>,
): LegacySessionData {
  return {
    key,
    meals: facts.meals ?? [],
    insulins: facts.insulins ?? [],
    glucoses: facts.glucoses ?? [],
    activities: facts.activities ?? [],
    snapshot: facts.snapshot ?? new Snapshot(),
    droppedActivities: facts.droppedActivities ?? 0,
  };
}

/**
 * Insulins from an `Insulin.serialize` array. `purpose` overrides the stored
 * one: these caches predate InjectionPurpose, so their insulins deserialize
 * as NOMINAL, but the cache they sit in says what they are. A NOMINAL copy of
 * a session's PREBOLUS merges into it without untagging it (Stream.push).
 */
export function convertLegacyInsulins(
  o: unknown,
  purpose?: InjectionPurpose,
): Insulin[] {
  return asArray(o).map((a) => {
    const insulin = Insulin.deserialize(a);
    if (purpose !== undefined) insulin.purpose = purpose;
    return insulin;
  });
}

export function convertLegacyRescues(o: unknown): Glucose[] {
  return asArray(o).map((a) => Glucose.deserialize(a));
}

/**
 * Plain `SugarReading.serialize` values into a snapshot. Timestamps are
 * rounded to the snapshot's serialized precision first: the stream's readings
 * have been through that rounding, and Snapshot.deduplicate only merges
 * identical timestamps, so an unrounded copy of a reading would be kept twice.
 */
export function convertLegacyReadings(o: unknown[]): Snapshot {
  const readings: SugarReading[] = [];
  for (const r of o) {
    if (r === null || r === undefined) continue;
    const reading = SugarReading.deserialize(r);
    const time = reading.timestamp.getTime();
    if (!Number.isFinite(reading.sugar) || !Number.isFinite(time) || time === 0)
      continue; // A reading with no time cannot be placed
    reading.timestamp = new Date(reducePrecision(time));
    readings.push(reading);
  }
  const snapshot = new Snapshot();
  snapshot.addReadings(...readings);
  snapshot.deduplicate();
  return snapshot;
}

/**
 * Undelivered inbox mail (`Mail.serialize` array). Its insulins carry no
 * purpose: RemoteInbox.basal sent basals as non-session insulin with the basal
 * variant, so that pair is what marks a basal. Activities were serialized in
 * the pre-stream format.
 */
export function convertLegacyInbox(
  o: unknown,
  basalVariantName: string,
): LegacySessionData {
  const facts = legacyFacts("store:nightscout.inboxCache", {});
  for (const m of asArray(o)) {
    if (!isObject(m)) continue;
    if (m.insulin) {
      const insulin = Insulin.deserialize(m.insulin);
      if (!m.isSessionApplicable && insulin.variant.name === basalVariantName)
        insulin.purpose = InjectionPurpose.Basal;
      facts.insulins.push(insulin);
    }
    if (m.glucose) facts.glucoses.push(Glucose.deserialize(m.glucose));
    if (m.meal) facts.meals.push(Meal.deserialize(m.meal));
    if (m.activity) {
      const converted = convertLegacyActivity(asActivity(m.activity) ?? {});
      if (converted) {
        facts.activities.push(converted.activity);
        facts.snapshot.absorb(converted.snapshot);
      } else facts.droppedActivities++;
    }
  }
  return facts;
}
