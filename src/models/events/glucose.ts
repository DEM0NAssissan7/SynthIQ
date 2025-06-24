import type MetabolismProfile from "../metabolism/metabolismProfile";
import MetaEvent from "./metaEvent";

export default class Glucose extends MetaEvent {
  _caps: number;
  constructor(timestamp: Date, caps: number) {
    super(timestamp);
    this._caps = caps;
  }

  set caps(c: number) {
    this._caps = c;
    this.notify();
  }
  get caps(): number {
    return this._caps;
  }

  deltaBG(t: number, profile: MetabolismProfile): number {
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
}
