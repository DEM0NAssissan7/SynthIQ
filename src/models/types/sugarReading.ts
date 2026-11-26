import { round } from "../../lib/util";
import type { Deserializer, Serializer } from "./types";

export enum ReadingType {
  Normal,
  Calibration,
  Manual,
}
export namespace ReadingType {
  export const serialize: Serializer<ReadingType> = (type) => type;
  export const deserialize: Deserializer<ReadingType> = (value) =>
    value as ReadingType;
}

export default class SugarReading {
  constructor(
    public sugar: number,
    public timestamp: Date,
    public type: ReadingType = ReadingType.Normal,
  ) {}

  static serialize: Serializer<SugarReading> = (r: SugarReading) => {
    const sugar = r.sugar;
    const time = r.timestamp.getTime();
    // The type is only written when it is not the default (Normal)
    if (r.type !== ReadingType.Normal)
      return [sugar, time, ReadingType.serialize(r.type)];
    if (time !== 0) return [sugar, time];
    return [sugar];
  };
  static deserialize: Deserializer<SugarReading> = (o) => {
    if (o.sugar) {
      // Backwards compatibility with old serializations
      return new SugarReading(
        o.sugar,
        new Date(o.timestamp),
        o.isCalibration ? ReadingType.Calibration : ReadingType.Normal,
      );
    }
    const sugar = o[0];
    const date = o[1] ? new Date(o[1]) : new Date(0);
    const type = o[2] ? ReadingType.deserialize(o[2]) : ReadingType.Normal;
    return new SugarReading(sugar, date, type);
  };
}

export function getReadingFromNightscout(o: {
  sgv?: number; // Sensor Glucose Value
  mbg?: number; // Meter Blood Glucose (more accurate)
  date?: string | number;
  dateString?: string;
  type?: string;
}): SugarReading {
  const isCalibration =
    o.type === "mbg" || o.type === "cal" || (!!o.mbg && !o.sgv);
  const type = isCalibration ? ReadingType.Calibration : ReadingType.Normal;
  const val = o.mbg ?? o.sgv ?? 0;
  const rawDate = o.dateString ?? o.date ?? 0;
  return new SugarReading(round(Number(val), 0), new Date(rawDate), type);
}
