import type { JSONValue } from "../../models/types/types";
import StorageNode, {
  readRawEntry,
  removeRawEntry,
  writeRawEntry,
} from "../../storage/storageNode";

/**
 * Raw access to the pre-stream ("wizard") storage keys.
 *
 * Nothing here deserializes into app classes: legacy data is read as plain
 * JSON so the migration keeps working after Session / MealTemplate change or
 * disappear. These keys are only ever read, then deleted once migrated.
 */
const LEGACY_NODE = "wizard";

export namespace LegacyWizardStore {
  /** `synthiq.wizard.templates`: the archive of every template and its sessions */
  export const templates = (): JSONValue | null =>
    readRawEntry(LEGACY_NODE, "templates");
  /** `synthiq.wizard.activeTemplate`: template the last session was filed under (may hold sessions not yet copied back into `templates`) */
  export const activeTemplate = (): JSONValue | null =>
    readRawEntry(LEGACY_NODE, "activeTemplate");
  /** `synthiq.wizard.currentTemplate`: template selected in the wizard */
  export const currentTemplate = (): JSONValue | null =>
    readRawEntry(LEGACY_NODE, "currentTemplate");
  /** `synthiq.wizard.session`: the in-progress session at the time of upgrade */
  export const session = (): JSONValue | null =>
    readRawEntry(LEGACY_NODE, "session");
  /** `synthiq.wizard.meal`: the meal being composed (not yet logged) */
  export const meal = (): JSONValue | null => readRawEntry(LEGACY_NODE, "meal");
}

/**
 * Raw access to the treatment / reading caches that duplicated the stream.
 * They are purged from the app; whatever they still hold is copied over.
 */
export namespace LegacyCacheStores {
  /** `synthiq.healthMonitor.recentBoluses`: last 16 boluses, including ones logged outside any meal session */
  export const recentBoluses = (): JSONValue | null =>
    readRawEntry("healthMonitor", "recentBoluses");
  /** `synthiq.healthMonitor.lastRescues`: last 16 rescues, including ones logged outside any meal session */
  export const lastRescues = (): JSONValue | null =>
    readRawEntry("healthMonitor", "lastRescues");
  /** `synthiq.healthMonitor.readingsHistory`: up to 24 h of CGM readings */
  export const readingsHistory = (): JSONValue | null =>
    readRawEntry("healthMonitor", "readingsHistory");
  /** `synthiq.healthMonitor.readingsCache`: newest 36 CGM readings */
  export const readingsCache = (): JSONValue | null =>
    readRawEntry("healthMonitor", "readingsCache");
  /** `synthiq.healthMonitor.fingersticks`: meter readings over the history window */
  export const fingersticks = (): JSONValue | null =>
    readRawEntry("healthMonitor", "fingersticks");
  /** `synthiq.basal.doses`: basal doses. Basals were never part of a meal session, so this is their only local copy */
  export const basalDoses = (): JSONValue | null =>
    readRawEntry("basal", "doses");
  /** `synthiq.cache.lastBG`: the last BG entered on the BG input */
  export const lastBG = (): JSONValue | null => readRawEntry("cache", "lastBG");
  /** `synthiq.nightscout.inboxCache`: treatments queued for the master that were never delivered */
  export const inboxCache = (): JSONValue | null =>
    readRawEntry("nightscout", "inboxCache");
}

/** Raw access to the pre-stream activity keys (`synthiq.activity.*`). Read only. */
const LEGACY_ACTIVITY_NODE = "activity";

export namespace LegacyActivityStore {
  /** `synthiq.activity.templates`: the archive of every finished activity, by name */
  export const templates = (): JSONValue | null =>
    readRawEntry(LEGACY_ACTIVITY_NODE, "templates");
  /** `synthiq.activity.activity`: the activity in progress (reset to an empty one when it ended) */
  export const activity = (): JSONValue | null =>
    readRawEntry(LEGACY_ACTIVITY_NODE, "activity");
}

/**
 * Every key of the pre-stream stores whose data now lives in the stream (or
 * was a cache of it), by node. Keys of these nodes that current stores still
 * own (e.g. basal.minTimeSinceMeal) are not listed.
 */
const LEGACY_KEYS: Record<string, string[]> = {
  wizard: [
    "templates",
    "currentTemplate",
    "activeTemplate",
    "page",
    "isPrebolus",
    "session",
    "meal",
  ],
  activity: ["templates", "template", "activity", "page"],
  basal: [
    "doses",
    "fastingVelocitiesCache",
    "fastingVelocitiesCacheLastUpdated",
    "fastingGlucosesCache",
    "lastRecommendation",
    "shotsSinceLastChange",
    "estimatedLiverOutput",
  ],
  healthMonitor: [
    "readingsCache",
    "readingsHistory",
    "fingersticks",
    "lastRescues",
    "recentBoluses",
    "recentMeals",
    "recentBasalTimes",
    "monitorStatusCache",
    "currentBG",
  ],
  nightscout: ["inboxCache"],
  migration: ["namedMeals", "migratedSessionsToStream"], // The pre-stream MigrationManager
};
/** Delete every legacy key. Returns how many keys were checked. */
export function purgeLegacyKeys(): number {
  let count = 0;
  for (const [node, ids] of Object.entries(LEGACY_KEYS))
    for (const id of ids) {
      removeRawEntry(node, id);
      count++;
    }
  return count;
}

/**
 * Restore the legacy keys of an exported data file (StorageNode.export
 * format). No StorageEntry owns them any more, so a plain import would drop
 * them: they are written raw and the migration is re-armed, so the next launch
 * migrates them into the stream (and then deletes them). Returns how many keys
 * were restored.
 */
export function importLegacyKeys(
  nodeObjects: { name: string; keys: { id: string; value: JSONValue }[] }[],
): number {
  let count = 0;
  for (const node of nodeObjects) {
    const ids = LEGACY_KEYS[node.name] ?? [];
    for (const key of node.keys)
      if (ids.includes(key.id)) {
        writeRawEntry(node.name, key.id, key.value);
        count++;
      }
  }
  if (count > 0) StreamMigrationStore.version.value = 0;
  return count;
}

/**
 * Bump STREAM_MIGRATION_VERSION whenever the conversion logic changes so that
 * every install re-runs it. Re-running is safe: Stream.push merges events that
 * are already present (same type + same timestamp). Note that installs which
 * already migrated have had their legacy keys purged, so a re-run there finds
 * nothing to convert.
 */
export const STREAM_MIGRATION_VERSION = 4;

export namespace StreamMigrationStore {
  const node = new StorageNode("migration");

  /** Highest STREAM_MIGRATION_VERSION successfully applied on this install (0 = never) */
  export const version = node.add("streamMigrationVersion", 0);
}
