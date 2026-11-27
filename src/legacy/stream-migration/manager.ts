import type MetaEvent from "../../models/events/metaEvent";
import Snapshot from "../../models/snapshot";
import type { Stream } from "../../models/stream";
import type { UUID } from "../../models/types/types";
import { genUUID } from "../../lib/util";
import Meal from "../../models/events/meal";
import { InjectionPurpose } from "../../models/events/insulin";
import SugarReading, { ReadingType } from "../../models/types/sugarReading";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { StreamStore } from "../../storage/streamStore";
import { EntryStore } from "../../storage/entryStore";
import {
  asActivity,
  asActivityTemplates,
  asSession,
  asTemplate,
  asTemplates,
  asArray,
  convertLegacyActivity,
  convertLegacyActivityArchive,
  convertLegacyInbox,
  convertLegacyInsulins,
  convertLegacyReadings,
  convertLegacyRescues,
  convertLegacySession,
  legacyFacts,
  resolveActivityGlucoses,
  type LegacySessionData,
  type LegacySessionJSON,
  type TemplateInfo,
} from "./serializers";
import {
  purgeLegacyKeys,
  LegacyActivityStore,
  LegacyCacheStores,
  LegacyWizardStore,
  STREAM_MIGRATION_VERSION,
  StreamMigrationStore,
} from "./store";

export interface StreamMigrationReport {
  sessions: number;
  duplicateSessions: number;
  failedSessions: number;
  droppedActivities: number;
  eventsAdded: number;
  eventsMerged: number;
  uuidsReassigned: number;
  /** Rescues found only inside activities (not copies of another rescue) */
  activityOnlyRescues: number;
  /** Non-session stores that failed to convert (the migration is retried) */
  failedSources: string[];
  /** An activity was in progress at upgrade time and was resumed in EntryStore */
  resumedActivity: boolean;
  /** A meal was being composed at upgrade time and was resumed in EntryStore */
  resumedMeal: boolean;
  /** The legacy keys were deleted (only after a fully successful migration) */
  purgedLegacyKeys: boolean;
}

/** Every legacy session found in storage, in priority order, each paired with its template */
function collectLegacySessions(): {
  session: LegacySessionJSON;
  template: TemplateInfo;
}[] {
  const found: { session: LegacySessionJSON; template: TemplateInfo }[] = [];
  const info = (t: { name?: string; UUID?: UUID } | null): TemplateInfo => ({
    name: t?.name || null,
    UUID: t?.UUID ?? null,
  });

  // 1. The archive. Canonical copy of every saved session.
  for (const template of asTemplates(LegacyWizardStore.templates()))
    for (const s of template.sessions ?? [])
      found.push({ session: s, template: info(template) });

  // 2. Copies held by the active / current template. Usually duplicates of the
  //    archive, but the active template can hold a session that was never
  //    copied back (its template was missing from the archive).
  const activeTemplate = asTemplate(LegacyWizardStore.activeTemplate());
  const currentTemplate = asTemplate(LegacyWizardStore.currentTemplate());
  for (const template of [activeTemplate, currentTemplate])
    for (const s of template?.sessions ?? [])
      found.push({ session: s, template: info(template) });

  // 3. The session that was in progress when the app was upgraded. It would
  //    have been filed under the active template at its next transition.
  const live = asSession(LegacyWizardStore.session());
  if (live) found.push({ session: live, template: info(activeTemplate) });

  return found;
}

const eventKey = (e: MetaEvent) =>
  `${e.constructor.name}:${e.timestamp.getTime()}`;

/**
 * Merge converted sessions into the stream.
 *
 * Stream.push treats two events as the same if they share a UUID *or* a type
 * and timestamp. Legacy UUIDs are not trustworthy (old 16-bit generator,
 * regenerated on load), so before pushing, every event is given a UUID that
 * cannot make it match a *different* event:
 * - same type + timestamp as an existing event → adopt that event's UUID (a true duplicate, merged)
 * - otherwise, if its UUID is already taken → give it a fresh one
 */
function mergeIntoStream(
  stream: Stream,
  sessions: LegacySessionData[],
  report: StreamMigrationReport,
) {
  const byKey = new Map<string, MetaEvent>();
  const usedUUIDs = new Set<UUID>();
  for (const e of stream.events) {
    byKey.set(eventKey(e), e);
    usedUUIDs.add(e.uuid);
  }

  const batch: MetaEvent[] = [];
  const readings = new Snapshot(); // Detached: absorbing into it writes nothing
  for (const s of sessions) {
    readings.absorb(s.snapshot);
    for (const e of [
      ...s.meals,
      ...s.insulins,
      ...s.glucoses,
      ...s.activities,
    ]) {
      const existing = byKey.get(eventKey(e));
      if (existing) {
        e.uuid = existing.uuid;
        report.eventsMerged++;
      } else {
        if (usedUUIDs.has(e.uuid)) {
          let uuid = genUUID();
          while (usedUUIDs.has(uuid)) uuid = genUUID();
          e.uuid = uuid;
          report.uuidsReassigned++;
        }
        byKey.set(eventKey(e), e);
        usedUUIDs.add(e.uuid);
        report.eventsAdded++;
      }
      batch.push(e);
    }
  }

  // One reading per instant; a session's initial measurement wins (see convertLegacySession)
  readings.deduplicate();
  for (const s of sessions)
    if (s.initialMeasurement)
      readings.setMeasurement(
        s.initialMeasurement.timestamp,
        s.initialMeasurement.sugar,
        s.initialMeasurement.type,
      );

  // One absorb + one push, so the stream is written twice rather than once per session
  stream.snapshot.absorb(readings);
  // A stream that already held a session's start (e.g. a re-import into a
  // migrated install) keeps its own copy on absorb: correct the ones that differ
  const streamMeasurements = new Map<number, number>();
  for (const r of stream.snapshot.readings)
    if (
      r.type !== ReadingType.Normal &&
      !streamMeasurements.has(r.timestamp.getTime())
    )
      streamMeasurements.set(r.timestamp.getTime(), r.sugar);
  for (const s of sessions) {
    const initial = s.initialMeasurement;
    if (!initial) continue;
    const held = streamMeasurements.get(initial.timestamp.getTime());
    if (held !== undefined && held !== initial.sugar)
      stream.snapshot.setMeasurement(
        initial.timestamp,
        initial.sugar,
        initial.type,
      );
  }
  stream.push(...batch);
  stream.sortEvents(); // push appends; the persisted copy is re-sorted on load
}

/**
 * Copy all legacy (template / stored session) data into the stream.
 *
 * Runs once per STREAM_MIGRATION_VERSION. Only a fully successful migration
 * is recorded, and only then are the legacy keys deleted (they hold nothing
 * the stream does not). A failed one leaves them untouched, so it can be fixed
 * and re-run from the original data on the next launch.
 */
export function migrateLegacyToStream(): StreamMigrationReport | null {
  if (StreamMigrationStore.version.value >= STREAM_MIGRATION_VERSION) {
    purgeLegacyKeys(); // Installs that migrated before keys were purged
    return null;
  }

  const report: StreamMigrationReport = {
    sessions: 0,
    duplicateSessions: 0,
    failedSessions: 0,
    failedSources: [],
    activityOnlyRescues: 0,
    droppedActivities: 0,
    eventsAdded: 0,
    eventsMerged: 0,
    uuidsReassigned: 0,
    resumedActivity: false,
    resumedMeal: false,
    purgedLegacyKeys: false,
  };

  const isFirstRun = StreamMigrationStore.version.value === 0;
  const converted: LegacySessionData[] = [];
  const seen = new Set<string>();
  const accept = (data: LegacySessionData) => {
    if (seen.has(data.key)) {
      report.duplicateSessions++;
      return false;
    }
    seen.add(data.key);
    report.droppedActivities += data.droppedActivities;
    converted.push(data);
    return true;
  };

  // 1. Meal sessions (templates + live session)
  for (const { session, template } of collectLegacySessions()) {
    let data: LegacySessionData;
    try {
      data = convertLegacySession(session, template);
    } catch (e) {
      report.failedSessions++;
      console.error(
        "Stream migration: failed to convert legacy session",
        e,
        session,
      );
      continue;
    }
    if (accept(data)) report.sessions++;
  }

  // 2. Every other store that held treatments or readings. Most of what they
  //    hold is a copy of an event from step 1 (same type + timestamp) and
  //    merges; what is left is what they alone knew (boluses / rescues logged
  //    outside a meal session, basals, readings outside any session).
  for (const source of collectLegacyStoreSources()) {
    try {
      for (const data of source.convert()) accept(data);
    } catch (e) {
      report.failedSources.push(source.name);
      console.error(`Stream migration: failed to convert ${source.name}`, e);
    }
  }

  // Rescues recorded inside activities: only those that are not copies
  const activityRescues = resolveActivityGlucoses(
    converted.flatMap((c) => c.activityGlucoses),
    [
      ...StreamStore.streamMain.value.rescues,
      ...converted.flatMap((c) => c.glucoses),
    ],
  );
  report.activityOnlyRescues = activityRescues.length;
  converted.push(
    legacyFacts("activity-rescues", { glucoses: activityRescues }),
  );

  mergeIntoStream(StreamStore.streamMain.value, converted, report);

  // 3. Work in progress at upgrade time. Neither is a stream event yet, so
  //    each is resumed as its EntryStore draft. Only on the first run: the
  //    legacy keys are never cleared, so a later run would resurrect a draft
  //    from the day of the upgrade.
  if (isFirstRun) {
    try {
      resumeDrafts(report);
    } catch (e) {
      report.failedSources.push("drafts");
      console.error("Stream migration: failed to resume drafts", e);
    }
  }

  if (report.failedSessions === 0 && report.failedSources.length === 0) {
    // Persist first: a write that fails throws here, before anything is deleted
    StreamStore.streamMain.write();
    StreamMigrationStore.version.value = STREAM_MIGRATION_VERSION;
    purgeLegacyKeys();
    report.purgedLegacyKeys = true;
  }

  console.info("Stream migration report", report);
  return report;
}

/** Legacy stores other than the meal sessions, each converted to stream facts */
function collectLegacyStoreSources(): {
  name: string;
  convert: () => LegacySessionData[];
}[] {
  return [
    {
      // Every finished activity. Ones also found in a meal session are the
      // same event (same snapshot, so same start) and merge.
      name: "activity.templates",
      convert: () => {
        const archive = convertLegacyActivityArchive(
          asActivityTemplates(LegacyActivityStore.templates()),
        );
        const data = archive.data;
        if (archive.dropped > 0)
          data.push(
            legacyFacts("store:activity.templates#dropped", {
              droppedActivities: archive.dropped,
            }),
          );
        return data;
      },
    },
    {
      name: "healthMonitor.recentBoluses",
      convert: () => [
        legacyFacts("store:healthMonitor.recentBoluses", {
          insulins: convertLegacyInsulins(LegacyCacheStores.recentBoluses()),
        }),
      ],
    },
    {
      name: "basal.doses",
      convert: () => [
        legacyFacts("store:basal.doses", {
          insulins: convertLegacyInsulins(
            LegacyCacheStores.basalDoses(),
            InjectionPurpose.Basal,
          ),
        }),
      ],
    },
    {
      name: "healthMonitor.lastRescues",
      convert: () => [
        legacyFacts("store:healthMonitor.lastRescues", {
          glucoses: convertLegacyRescues(LegacyCacheStores.lastRescues()),
        }),
      ],
    },
    {
      name: "readings",
      convert: () => {
        const readings: unknown[] = [
          ...asArray(LegacyCacheStores.readingsHistory()),
          ...asArray(LegacyCacheStores.readingsCache()),
          ...asArray(LegacyCacheStores.fingersticks()),
        ];
        // The last entered BG is a real reading only when it was a
        // measurement (legacy: a "calibration"). Otherwise it is a CGM value
        // copied at the time of the pull, not at the time of the reading,
        // which the CGM caches hold.
        const lastBG = LegacyCacheStores.lastBG();
        if (lastBG !== null) {
          const reading = SugarReading.deserialize(lastBG);
          if (reading.type !== ReadingType.Normal) readings.push(lastBG);
        }
        return [
          legacyFacts("store:readings", {
            snapshot: convertLegacyReadings(readings),
          }),
        ];
      },
    },
    {
      name: "nightscout.inboxCache",
      convert: () => [
        convertLegacyInbox(
          LegacyCacheStores.inboxCache(),
          InsulinVariantManager.getBasalVariant().name,
        ),
      ],
    },
  ];
}

function resumeDrafts(report: StreamMigrationReport) {
  // Activity in progress: no end yet, so it resumes and ends normally
  if (!EntryStore.activityIsActive.value) {
    const live = asActivity(LegacyActivityStore.activity());
    const resumed = live ? convertLegacyActivity(live) : null;
    if (resumed && resumed.activity.name) {
      StreamStore.streamMain.value.snapshot.absorb(resumed.snapshot);
      resumed.activity.value = 0;
      EntryStore.activity.value = resumed.activity;
      EntryStore.activityIsActive.value = true;
      report.resumedActivity = true;
    }
  }

  // Meal being composed: not logged yet, so it goes back to the meal draft
  if (EntryStore.meal.value.isEmpty) {
    const raw = LegacyWizardStore.meal();
    const draft = raw !== null ? Meal.deserialize(raw) : null;
    if (draft && !draft.isEmpty) {
      EntryStore.meal.value = draft;
      report.resumedMeal = true;
    }
  }
}
