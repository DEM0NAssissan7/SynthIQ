import { profile } from "../storage/metaProfileStore";

export enum InsulinType {
  Regular,
  Novolog,
}
export default class Insulin {
  units: number;
  timestamp: Date;
  type: InsulinType;
  constructor(
    timestamp: Date,
    units: number,
    type: InsulinType = InsulinType.Regular
  ) {
    this.timestamp = timestamp;
    this.units = units;
    this.type = type;
  }
  deltaBG(t: number): number {
    // Change in blood sugar over time
    return profile.insulin.deltaBG(t, this.units);
  }
  static stringify(i: Insulin): string {
    return JSON.stringify({
      timestamp: i.timestamp,
      units: i.units,
      type: i.type,
    });
  }
  static parse(s: string): Insulin {
    let o = JSON.parse(s);
    const timestamp = new Date(o.timestamp);
    const units = parseFloat(o.units);
    const type = o.type;
    return new Insulin(timestamp, units, type);
  }
}
