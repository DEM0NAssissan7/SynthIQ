/**
 * So this is a shift from the previous model.
 * Instead of collecting only a few data points and storing them (start, min, max, end)
 * we collect ALL relevant data points (including calibrations) and then infer
 * those values based on what it's been given. We can also use smoothing if necessary
 */

import RemoteReadings from "../lib/remote/readings";
import { convertDimensions, MathUtil } from "../lib/util";
import { PrivateStore } from "../storage/privateStore";
import Subscribable from "./subscribable";
import SugarReading, { getReadingFromNightscout } from "./types/sugarReading";
import type { Deserializer, Serializer } from "./types/types";
import Unit from "./unit";

const precisionMS = 10 * 1000;
const reducePrecision = (x: number, precision: number = precisionMS) =>
  Math.round(x / precision) * precision;
export default class Snapshot extends Subscribable {
  private rawReadings: SugarReading[] = [];

  private readingsCache: SugarReading[] = [];
  private timeSortedCache: SugarReading[] = [];
  private valueSortedCache: SugarReading[] = [];
  private invalidateCaches() {
    this.readingsCache = [];
    this.timeSortedCache = [];
    this.valueSortedCache = [];
  }
  addReading(r: SugarReading, doNotify = true) {
    this.rawReadings.push(r);
    this.invalidateCaches();
    if (doNotify) this.notify();
  }
  absorb(snapshot: Snapshot) {
    snapshot.rawReadings.forEach((r) => this.addReading(r));
  }
  get readings(): SugarReading[] {
    // This is for when we implement smoothing
    if (this.readingsCache.length === 0) {
      this.readingsCache = this.rawReadings;
    }
    return this.readingsCache;
  }
  private get calibrations(): SugarReading[] {
    // We filter through raw readings because calibrations don't need to be smoothed
    return this.rawReadings.filter((r) => r.isCalibration);
  }
  private get numericalReadings() {
    return this.readings.map((r) => r.sugar);
  }
  private get timeSorted() {
    if (this.timeSortedCache.length === 0) {
      // Sorts it from oldest -> latest
      // We prioritize using calibrations in this case because on the user-end it is much easier to mark the beginning and end glucose rather than the peaks
      let readings = this.readings;
      const calibrations = this.calibrations;
      if (calibrations.length !== 0) readings = calibrations;
      this.timeSortedCache = readings
        .slice()
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    return this.timeSortedCache;
  }
  private get valueSorted() {
    if (this.valueSortedCache.length === 0) {
      // Sorts it from lowest -> highest
      // We don't prioritize calibrations because user won't know when BG peaks
      this.valueSortedCache = this.readings
        .slice()
        .sort((a, b) => a.sugar - b.sugar);
    }
    return this.valueSortedCache;
  }

  private get isValid() {
    return this.rawReadings.length !== 0;
  }
  private createContemporaryCalibration(value: number) {
    this.addReading(new SugarReading(value, new Date(), true));
  }

  async pullReadings() {
    // Pull readings from backend
    if (!this.initialBG || !this.finalBG)
      throw new Error(`Cannot pull glucose readings: snapshot incomplete`);
    const remoteReadings = await RemoteReadings.getReadings(
      this.initialBG.timestamp,
      this.finalBG.timestamp
    );
    const rawReadings = remoteReadings.map((r) => getReadingFromNightscout(r));
    if (PrivateStore.debugLogs.value) console.log(rawReadings);
    rawReadings.forEach((r) => this.addReading(r, false));
    this.notify();
  }

  get initialBG(): SugarReading | null {
    if (!this.isValid) return null;
    return this.isValid ? this.timeSorted[0] : null;
  }
  set initialBG(value: number) {
    this.createContemporaryCalibration(value);
  }

  get finalBG(): SugarReading | null {
    return this.isValid ? this.timeSorted[this.timeSorted.length - 1] : null;
  }
  set finalBG(value: number) {
    this.createContemporaryCalibration(value);
    this.pullReadings();
  }

  get minBG(): SugarReading | null {
    return this.isValid
      ? this.valueSorted[Math.round(this.valueSorted.length * 0.1)] // Get the bottom 10%
      : null;
  }
  get peakBG(): SugarReading | null {
    return this.isValid
      ? this.valueSorted[Math.floor(this.valueSorted.length * 0.9)] // Get the top 10%
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

  // Serialization
  static serialize: Serializer<Snapshot> = (s: Snapshot) => {
    let baseTime = 0;
    let timeJump = 0;
    const readings = s.rawReadings
      .slice()
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
            reducePrecision(reading.timestamp.getTime())
        );
      }
      timeJump = Math.round(MathUtil.mean(jumps));
    }
    return {
      rawReadings: readings.map((r, i) => {
        // Create a *new* Date for the serialized value; do not touch r.timestamp
        const offsetMs =
          reducePrecision(r.timestamp.getTime()) - baseTime - timeJump * i;
        const clone = new SugarReading(
          r.sugar,
          new Date(offsetMs),
          r.isCalibration
        );
        return SugarReading.serialize(clone);
      }),
      baseTime: baseTime,
      timeJump: timeJump,
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
          reading.timestamp.getTime() + baseTime + timeJump * i
        ); // Bring forward by basetime
        return reading;
      }
    );
    readings.forEach((r) => snapshot.addReading(r, false));
    return snapshot;
  };
}
