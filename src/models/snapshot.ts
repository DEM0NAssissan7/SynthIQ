/**
 * So this is a shift from the previous model.
 * Instead of collecting only a few data points and storing them (start, min, max, end)
 * we collect ALL relevant data points (including calibrations) and then infer
 * those values based on what it's been given. We can also use smoothing if necessary
 */

import RemoteReadings from "../lib/remote/readings";
import Subscribable from "./subscribable";
import SugarReading, { getReadingFromNightscout } from "./types/sugarReading";
import type { Deserializer, Serializer } from "./types/types";

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
  private get readings(): SugarReading[] {
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

  private checkValid() {
    if (this.rawReadings.length === 0)
      throw new Error(`No readings present in snapshot!`);
  }
  private createContemporaryCalibration(value: number) {
    this.addReading(new SugarReading(value, new Date(), true));
  }

  async pullReadings() {
    // Pull readings from backend
    this.checkValid();
    const remoteReadings = await RemoteReadings.getReadings(
      this.initialBG.timestamp,
      this.finalBG.timestamp
    );
    const rawReadings = remoteReadings.map((r) => getReadingFromNightscout(r));
    console.log(rawReadings);
    rawReadings.forEach((r) => this.addReading(r, false));
    this.notify();
  }

  get initialBG(): SugarReading {
    this.checkValid();
    return this.timeSorted[0];
  }
  set initialBG(value: number) {
    this.createContemporaryCalibration(value);
  }

  get finalBG(): SugarReading {
    this.checkValid();
    return this.timeSorted[this.timeSorted.length - 1];
  }
  set finalBG(value: number) {
    this.createContemporaryCalibration(value);
    this.pullReadings();
  }

  get minBG(): SugarReading {
    this.checkValid();
    return this.valueSorted[0];
  }
  get peakBG(): SugarReading {
    this.checkValid();
    return this.valueSorted[this.valueSorted.length - 1];
  }

  // Serialization
  static serialize: Serializer<Snapshot> = (s: Snapshot) => {
    return JSON.stringify({
      rawReadings: s.rawReadings.map((r) => SugarReading.serialize(r)),
    });
  };
  static deserialize: Deserializer<Snapshot> = (s: string) => {
    const o = JSON.parse(s);
    let snapshot = new Snapshot();
    const readings: SugarReading[] = o.rawReadings.map((s: string) =>
      SugarReading.deserialize(s)
    );
    readings.forEach((r) => snapshot.addReading(r, false));
    return snapshot;
  };
}
