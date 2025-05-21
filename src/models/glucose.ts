import metaProfile from "../storage/metaProfileStore";
import MetabolismFunction from "./metabolismFunction";

export default class Glucose {
  caps: number;
  grams: number;
  timestamp: Date;
  constructor(timestamp: Date, caps: number) {
    this.caps = caps;
    this.grams =
      caps * metaProfile.get("mlsPerCap") * metaProfile.get("gramsPerMl");
    this.timestamp = timestamp;
  }
  deltaBG(t: number): number {
    return MetabolismFunction.glucose(t, this.grams);
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
}
