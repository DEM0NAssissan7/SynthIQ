import { round } from "../../lib/util";
import type { Deserializer, Serializer } from "./types";

export default class SugarReading {
  constructor(
    public sugar: number,
    public timestamp: Date,
    public isCalibration: boolean = false,
  ) {}

  static serialize: Serializer<SugarReading> = (r: SugarReading) => {
    const sugar = r.sugar;
    const time = r.timestamp.getTime();
    const calibration = r.isCalibration ? 1 : 0;
    if (calibration === 1) return [sugar, time, calibration];
    if (time !== 0) return [sugar, time];
    return [sugar];
  };
  static deserialize: Deserializer<SugarReading> = (o) => {
    if (o.sugar) {
      // Backwards compatibility with old serializations
      return new SugarReading(
        o.sugar,
        new Date(o.timestamp),
        o.isCalibration ? true : false,
      );
    }
    const sugar = o[0];
    const date = o[1] ? new Date(o[1]) : new Date(0);
    const calibration = o[2] ? true : false;
    return new SugarReading(sugar, date, calibration);
  };
}

export function getReadingFromNightscout(o: {
  sgv: number; // Sensor Glucose Value
  mbg: number; // Meter Blood Glucose (more accurate)
  date: string;
}): SugarReading {
  const isCalibration = !!o.mbg;
  return new SugarReading(
    round(o.mbg ?? o.sgv, 0),
    new Date(o.date),
    isCalibration,
  );
}
