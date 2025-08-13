import type { Deserializer, Serializer } from "./types";

export default class SugarReading {
  constructor(
    public sugar: number,
    public timestamp: Date,
    public isCalibration: boolean = false
  ) {}

  static serialize: Serializer<SugarReading> = (r: SugarReading) => {
    return JSON.stringify({
      sugar: r.sugar,
      timestamp: r.timestamp.toString(),
      isCalibration: r.isCalibration,
    });
  };
  static deserialize: Deserializer<SugarReading> = (s: string) => {
    const o = JSON.parse(s);
    return new SugarReading(
      o.sugar,
      new Date(o.timestamp),
      o.isCalibration || false
    );
  };
}

export function getReadingFromNightscout(o: {
  sgv: number;
  date: string;
}): SugarReading {
  return new SugarReading(o.sgv, new Date(o.date), false);
}
export function createNightscoutReading(r: SugarReading) {
  return {
    sgv: r.sugar,
    date: r.timestamp,
  };
}
