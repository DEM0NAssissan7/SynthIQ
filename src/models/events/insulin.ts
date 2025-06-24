import type MetabolismProfile from "../metabolism/metabolismProfile";
import MetaEvent from "./metaEvent";

export enum InsulinType {
  Regular,
  Novolog,
}
export default class Insulin extends MetaEvent {
  _units: number;
  _type: InsulinType;
  constructor(
    timestamp: Date,
    units: number,
    type: InsulinType = InsulinType.Regular
  ) {
    super(timestamp);
    this._units = units;
    this._type = type;
  }

  set units(u: number) {
    this._units = u;
    this.notify();
  }
  get units(): number {
    return this._units;
  }

  set type(t: InsulinType) {
    this._type = t;
    this.notify();
  }
  get type() {
    return this._type;
  }

  deltaBG(t: number, profile: MetabolismProfile): number {
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
