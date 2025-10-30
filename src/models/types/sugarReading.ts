import type { Deserializer, Serializer } from "./types";

export default class SugarReading {
  constructor(
    public sugar: number,
    public timestamp: Date,
    public isCalibration: boolean = false
  ) {}

  static serialize: Serializer<SugarReading> = (r: SugarReading) => {
    return [r.sugar, r.timestamp.getTime(), r.isCalibration ? 1 : 0];
  };
  static deserialize: Deserializer<SugarReading> = (o) => {
    if (o.sugar) {
      // Backwards compatibility with old serializations
      return new SugarReading(
        o.sugar,
        new Date(o.timestamp),
        o.isCalibration ? true : false
      );
    }
    return new SugarReading(o[0], new Date(o[1]), o[2] ? true : false);
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
