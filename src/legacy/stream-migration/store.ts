import type { JSONValue } from "../../models/types/types";
import StorageNode, { readRawEntry } from "../../storage/storageNode";

/**
 * Raw access to the pre-stream ("wizard") storage keys.
 *
 * Nothing here deserializes into app classes: legacy data is read as plain
 * JSON so the migration keeps working after Session / MealTemplate change or
 * disappear. These keys are only ever read, never written.
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
 * Bump STREAM_MIGRATION_VERSION whenever the conversion logic changes so that
 * every install re-runs it. Re-running is safe: Stream.push merges events that
 * are already present (same type + same timestamp).
 */
export const STREAM_MIGRATION_VERSION = 3;

export namespace StreamMigrationStore {
  const node = new StorageNode("migration");

  /** Highest STREAM_MIGRATION_VERSION successfully applied on this install (0 = never) */
  export const version = node.add("streamMigrationVersion", 0);
}
