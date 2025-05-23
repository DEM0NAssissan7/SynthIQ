import { profile } from "../storage/metaProfileStore";

export default class Glucose {
  caps: number;
  timestamp: Date;
  constructor(timestamp: Date, caps: number) {
    this.caps = caps;
    this.timestamp = timestamp;
  }
  deltaBG(t: number): number {
    return profile.glucose.deltaBG(t, this.caps);
  }
  static stringify(g: Glucose): string {
    return JSON.stringify({
      caps: g.caps,
      timestamp: g.timestamp,
    });
  }
  static parse(s: string): Glucose {
    let o = JSON.parse(s);
    return new Glucose(new Date(o.timestamp), o.caps);
  }
  get grams(): number {
    return this.caps * profile.glucose.mlsPerCap * profile.glucose.gramsPerMl;
  }
}
