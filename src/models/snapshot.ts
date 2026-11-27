/**
 * So this is a shift from the previous model.
 * Instead of collecting only a few data points and storing them (start, min, max, end)
 * we collect ALL relevant data points (including calibrations) and then infer
 * those values based on what it's been given. We can also use smoothing if necessary
 */

import RemoteReadings from "../lib/remote/readings";
import { timestampIsBetween } from "../lib/timing";
import { convertDimensions, MathUtil } from "../lib/util";
import { PreferencesStore } from "../storage/preferencesStore";
import { PrivateStore } from "../storage/privateStore";
import Subscribable from "./subscribable";
import SugarReading, {
  getReadingFromNightscout,
  ReadingType,
} from "./types/sugarReading";
import type { Deserializer, Serializer } from "./types/types";
import Unit from "./unit";

/** Timestamp resolution of a serialized snapshot: readings round-trip rounded to this */
export const precisionMS = 10 * 1000;
export const reducePrecision = (x: number, precision: number = precisionMS) =>
  Math.round(x / precision) * precision;
/**
 * Whether a reading is a blood sugar at all. Anything outside this range is
 * not a measurement: e.g. uploaders write an `sgv: 0` placeholder entry next
 * to every fingerstick. Such readings are never kept, in memory or in storage.
 */
export const isStorableReading = (r: SugarReading) =>
  r.sugar > 20 && r.sugar < 600;

export default class Snapshot extends Subscribable {
  private rawReadings: SugarReading[] = [];
  private valueSortedCache: SugarReading[] = [];
  private deduplicated = false;
  private isSorted: boolean = false;
  private invalidateCaches() {
    this.isSorted = false;
    this.valueSortedCache = [];
  }
  private add(readings: SugarReading[]) {
    // Loop instead of push(...readings): spreading a large array overflows the call stack
    for (const reading of readings) {
      if (!isStorableReading(reading)) continue;
      // Readings live at the resolution they are stored at, so a reading that
      // arrives again (e.g. re-synced) is the same instant as its stored copy
      const time = reading.timestamp.getTime();
      const rounded = reducePrecision(time);
      if (rounded !== time) reading.timestamp = new Date(rounded);
      this.rawReadings.push(reading);
    }
    this.invalidateCaches();
    this.deduplicated = false;
  }
  addReadings(...r: SugarReading[]) {
    // Add reading & notify
    this.add(r);
    this.notify();
  }
  /** Add readings, replacing any already at the same instant */
  upsert(readings: SugarReading[]) {
    const incoming = new Snapshot();
    incoming.add(readings);
    const byTime = new Map<number, SugarReading>();
    for (const r of this.rawReadings) byTime.set(r.timestamp.getTime(), r);
    for (const r of incoming.rawReadings) byTime.set(r.timestamp.getTime(), r);
    this.rawReadings = Array.from(byTime.values());
    this.invalidateCaches();
    this.notify();
  }
  absorb(...snapshots: Snapshot[]) {
    snapshots.forEach((snapshot) => this.add(snapshot.rawReadings));
    this.notify();
  }
  contains(timestamp: Date) {
    return timestampIsBetween(timestamp, this.startTime, this.endTime);
  }
  view(since: Date, until: Date | null = null): Snapshot {
    const snapshot = new Snapshot();
    const timeA = since.getTime();
    const timeB = until?.getTime() ?? null;
    const readings = this.readings;
    // Binary search for the first reading in range: views are taken constantly
    let low = 0;
    let high = readings.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (readings[mid].timestamp.getTime() < timeA - precisionMS / 2)
        low = mid + 1;
      else high = mid;
    }
    for (let i = low; i < readings.length; i++) {
      const reading = readings[i];
      if (timeB && reading.timestamp.getTime() > timeB + precisionMS / 2) break;
      snapshot.rawReadings.push(reading);
    }
    return snapshot;
  }
  looseView(timestampA: Date, timestampB: Date, measurements = false) {
    // A looser version of view that takes advantage of the getReading to ensure that there's a bit of leeway
    const leftReading = this.getReading(timestampA, measurements);
    const rightReading = this.getReading(timestampB, measurements);
    if (!leftReading || !rightReading) return null;
    return this.view(leftReading.timestamp, rightReading.timestamp);
  }
  getReading(timestamp: Date, measuredOnly = false, reverse = false) {
    // Shows what the user had seen at `timestamp` from their CGM/meter
    const time = timestamp.getTime();
    const readings = measuredOnly ? this.timeSortedMeasurements : this.readings;
    if (readings.length <= 0)
      throw new Error(`Cannot get reading: readings is empty`);
    if (reverse) {
      let retval: SugarReading = readings[readings.length - 1];
      for (let i = readings.length - 1; i >= 0; i--) {
        const reading = readings[i];
        if (reading.timestamp.getTime() < time) break;
        retval = reading;
      }
      return retval;
    }
    let retval: SugarReading = readings[0];
    for (const reading of readings) {
      if (reading.timestamp.getTime() > time) break;
      retval = reading;
    }
    return retval;
  }
  getSmoothed(timestamp: Date, measuredOnly = false) {
    const readingA = this.getReading(timestamp, measuredOnly, false);
    const readingB = this.getReading(timestamp, measuredOnly, true);
    const dt = readingB.timestamp.getTime() - readingA.timestamp.getTime();
    // Exactly on a reading, or past the end of the snapshot
    if (dt === 0) return readingA.sugar;
    const x = timestamp.getTime() - readingA.timestamp.getTime();
    const m = (readingB.sugar - readingA.sugar) / dt;
    const b = readingA.sugar;
    return m * x + b;
  }
  // This should ONLY be used on duplicated snapshots - never on real, observed data. This is purely a software helper.
  shift(value: number) {
    this.rawReadings.forEach((r) => (r.sugar += value));
    this.invalidateCaches();
    this.notify();
  }
  get readings(): SugarReading[] {
    if (!this.isSorted) {
      this.rawReadings.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      this.isSorted = true;
    }
    return this.rawReadings;
  }
  /** The newest `count` readings, newest first */
  latest(count: number, measurements = true): SugarReading[] {
    const latest: SugarReading[] = [];
    const timeSorted = this.readings;
    for (let i = timeSorted.length - 1; i >= 0; i--) {
      if (latest.length >= count) break;
      const reading = timeSorted[i];
      if (!measurements && reading.type !== ReadingType.Normal) continue;
      latest.push(reading);
    }
    return latest;
  }
  get isEmpty(): boolean {
    return this.rawReadings.length <= 0;
  }
  get hasMeasurements(): boolean {
    return this.measurements.length > 0;
  }
  /**
   * Measured blood sugars, as opposed to CGM readings: meter calibrations
   * (from Nightscout) and manual entries. They anchor what a snapshot starts
   * and ends at.
   */
  private get measurements(): SugarReading[] {
    // We filter through raw readings because measurements don't need to be smoothed
    return this.rawReadings.filter((r) => r.type !== ReadingType.Normal);
  }
  private get numericalReadings() {
    return this.readings.map((r) => r.sugar);
  }
  private get timeSortedMeasurements(): SugarReading[] {
    return this.measurements
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  private get valueSorted() {
    if (this.valueSortedCache.length === 0) {
      // Sorts it from lowest -> highest
      // We don't prioritize measurements because user won't know when BG peaks
      this.valueSortedCache = this.readings
        .slice()
        .sort((a, b) => a.sugar - b.sugar);
    }
    return this.valueSortedCache;
  }

  private get isValid() {
    return this.rawReadings.length !== 0;
  }
  /** Set the measurement at `timestamp`: the existing one is corrected, or a new one added */
  setMeasurement(timestamp: Date, value: number, type: ReadingType) {
    const time = timestamp.getTime();
    const existing = this.rawReadings.find(
      (r) => r.type !== ReadingType.Normal && r.timestamp.getTime() === time,
    );
    if (!existing) {
      this.addReadings(new SugarReading(value, timestamp, type));
      return;
    }
    existing.sugar = value;
    existing.type = type;
    this.invalidateCaches();
    this.notify();
  }
  private createContemporaryManual(value: number) {
    this.addReadings(new SugarReading(value, new Date(), ReadingType.Manual));
  }
  deduplicate() {
    if (this.deduplicated) return;
    const byTime = new Map<number, SugarReading>();
    this.rawReadings.forEach((reading) => {
      const readingTime = reading.timestamp.getTime();
      const existing = byTime.get(readingTime);
      // A measurement beats a CGM reading at the same time: its value is the measured one
      if (
        !existing ||
        (reading.type !== ReadingType.Normal &&
          existing.type === ReadingType.Normal)
      )
        byTime.set(readingTime, reading);
    });
    this.rawReadings = Array.from(byTime.values());
    this.invalidateCaches();
    this.deduplicated = true;
  }

  async pullReadings() {
    // Pull readings from backend
    if (!this.initialBG || !this.finalBG)
      throw new Error(`Cannot pull glucose readings: snapshot incomplete`);
    try {
      const remoteReadings = await RemoteReadings.getReadings(
        this.initialBG.timestamp,
        this.finalBG.timestamp,
      );
      const rawReadings = remoteReadings
        .filter((r) => r && (r.sgv != null || r.mbg != null))
        .map((r) => getReadingFromNightscout(r))
        .filter((r) => !isNaN(r.sugar) && !isNaN(r.timestamp.getTime()));
      if (PrivateStore.debugLogs.value) console.log(rawReadings);
      this.add(rawReadings);
      this.deduplicate();
      this.notify();
    } catch (e) {
      if (PrivateStore.debugLogs.value) {
        console.error("Snapshot.pullReadings error:", e);
      }
    }
  }

  get initialBG(): SugarReading | null {
    if (!this.isValid) return null;
    return this.isValid ? this.readings[0] : null;
  }
  set initialBG(value: number) {
    if (this.isValid && this.readings[0].type !== ReadingType.Normal) {
      this.readings[0].sugar = value;
      this.invalidateCaches();
      this.notify();
    } else {
      this.createContemporaryManual(value);
    }
  }

  get finalBG(): SugarReading | null {
    return this.isValid ? this.readings[this.readings.length - 1] : null;
  }
  set finalBG(value: number) {
    this.createContemporaryManual(value);
    this.pullReadings();
  }

  get minBG(): SugarReading | null {
    return this.isValid
      ? this.valueSorted[Math.round(this.valueSorted.length * 0.05)] // Get the bottom 5%
      : null;
  }
  get peakBG(): SugarReading | null {
    return this.isValid
      ? this.valueSorted[Math.floor(this.valueSorted.length * 0.95)] // Get the top 5%
      : null;
  }

  get averageBG(): number {
    return MathUtil.mean(this.numericalReadings);
  }
  get medianBG(): number {
    return MathUtil.median(this.numericalReadings);
  }

  get length(): number {
    // Returns the length of the snapshot in hours
    const initialBG = this.initialBG;
    const finalBG = this.finalBG;
    if (!initialBG || !finalBG) return 0;
    return (
      (finalBG.timestamp.getTime() - initialBG.timestamp.getTime()) *
      convertDimensions(Unit.Time.Millis, Unit.Time.Hour)
    );
  }

  // Metabolic Stress
  get deviations() {
    const targetBG = PreferencesStore.targetBG.value;
    const lowThreshold = PreferencesStore.lowBG.value;
    if (!this.initialBG || !this.peakBG || !this.minBG || !this.finalBG)
      return [Infinity]; // Incompleteness sentinel — gives an impossibly bad score

    let deviations = [];
    const wentLow = this.minBG.sugar < lowThreshold;

    const adjustedDelta = (delta: number, tol = 0) =>
      Math.abs(delta <= tol ? 0 : delta - tol);

    if (this.initialBG.sugar >= targetBG) {
      deviations.push(adjustedDelta(this.peakBG.sugar - this.initialBG.sugar));
      if (wentLow) {
        deviations.push(adjustedDelta(targetBG - this.minBG.sugar));
      }
    } else {
      deviations.push(adjustedDelta(this.peakBG.sugar - targetBG));
      if (wentLow) {
        deviations.push(adjustedDelta(this.initialBG.sugar - this.minBG.sugar));
      }
    }
    if (
      (this.finalBG.sugar < targetBG && this.finalBG.sugar < lowThreshold) ||
      this.finalBG.sugar > targetBG
    )
      deviations.push(Math.abs(this.finalBG.sugar - targetBG));

    // Add IAD (integrated absolute deviation)
    deviations.push(
      MathUtil.mean(
        this.readings.map((r) => adjustedDelta(r.sugar - targetBG)),
      ),
    );
    return deviations;
  }

  // Timestamp stuff
  get startTime(): Date {
    const timeSorted = this.readings;
    if (timeSorted.length === 0)
      throw new Error(`Cannot get start time: no readings`);
    const reading = timeSorted[0];
    if (!reading) throw new Error(`Cannot get start time: unknown error`);
    return reading.timestamp;
  }
  get endTime(): Date {
    const timeSorted = this.readings;
    const reading = timeSorted[timeSorted.length - 1];
    if (!reading) throw new Error(`Cannot get end time: unknown error`);
    return reading.timestamp;
  }

  // Serialization
  static serialize: Serializer<Snapshot> = (s: Snapshot) => {
    let baseTime = 0;
    let timeJump = 0;
    s.deduplicate();
    const readings = s.rawReadings
      .slice()
      .filter(isStorableReading)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstReading = readings[0];
    if (firstReading) {
      baseTime = firstReading.timestamp.getTime();

      // Get median jump
      let jumps: number[] = [];
      for (let i = 0; i < readings.length - 1; i++) {
        const reading = readings[i];
        const nextReading = readings[i + 1];
        jumps.push(
          reducePrecision(nextReading.timestamp.getTime()) -
            reducePrecision(reading.timestamp.getTime()),
        );
      }
      timeJump = Math.round(MathUtil.mean(jumps));
    }
    return {
      rawReadings: readings.map((r, i) => {
        // Create a *new* Date for the serialized value; do not touch r.timestamp
        const offsetMs =
          reducePrecision(r.timestamp.getTime()) - baseTime - timeJump * i;
        const clone = new SugarReading(r.sugar, new Date(offsetMs), r.type);
        return SugarReading.serialize(clone);
      }),
      baseTime: baseTime,
      timeJump: timeJump,
      deduplicated: s.deduplicated,
      isSorted: s.isSorted,
    };
  };
  static deserialize: Deserializer<Snapshot> = (o) => {
    let snapshot = new Snapshot();
    let baseTime = o.baseTime ?? 0;
    let timeJump = o.timeJump ?? 0;
    const readings: SugarReading[] = o.rawReadings.map(
      (s: string, i: number) => {
        const reading = SugarReading.deserialize(s);
        reading.timestamp = new Date(
          reading.timestamp.getTime() + baseTime + timeJump * i,
        ); // Bring forward by basetime
        return reading;
      },
    );
    snapshot.rawReadings = readings;
    snapshot.deduplicated = o.deduplicated ?? false;
    snapshot.isSorted = o.isSorted ?? false;
    return snapshot;
  };
}
