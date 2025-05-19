import { metaProfile } from "../lib/metabolism";
import MetaFunctions, { metaKernel } from "./metaFunctions";

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
    return metaKernel(
      t,
      this.units * metaProfile.get("einsulin"),
      metaProfile.get("ninsulin"),
      metaProfile.get("pinsulin"),
      MetaFunctions.H // Half life decay
    );
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
    return new Insulin(new Date(o.timestamp), o.units, o.type);
  }
}
