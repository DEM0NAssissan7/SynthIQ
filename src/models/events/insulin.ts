import { getHourDiff } from "../../lib/timing";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { InsulinVariant } from "../types/insulinVariant";
import type { Deserializer, Serializer } from "../types/types";
import MetaEvent from "./metaEvent";
import ScalarMetaEvent from "./scalarEvent";

export default class Insulin extends MetaEvent implements ScalarMetaEvent {
  _value: number;
  variant: InsulinVariant;
  set value(value: number) {
    this._value = value;
    this.notify();
  }
  get value() {
    return this._value;
  }

  constructor(value: number, timestamp: Date, variant: InsulinVariant) {
    super(timestamp);
    this._value = value;
    this.variant = variant;
  }

  // t is the number of hours post-injection
  private getHours(time: Date) {
    return getHourDiff(time, this.timestamp);
  }
  bateman(time: Date, unit = false) {
    const t = this.getHours(time);
    return (unit ? 1 : this.value) * this.variant.unitBateman(t);
  }
  batemanIntegral(timeA: Date, timeB: Date, unit = false) {
    const tA = this.getHours(timeA);
    const tB = this.getHours(timeB);
    return (unit ? 1 : this.value) * this.variant.unitBatemanIntegral(tA, tB);
  }
  iob(time: Date) {
    return this.value * this.variant.fractionActive(this.getHours(time));
  }
  absorptionRate(time: Date) {
    return this.bateman(time);
  }

  // Insulin Activity
  getActivityStatus(time: Date): boolean {
    // Active while within 5 elimination half-lives (variant.duration)
    return this.getHours(time) < this.variant.duration;
  }
  get isActive(): boolean {
    return this.getActivityStatus(new Date());
  }
  get duration(): number {
    // Fixed pharmacokinetic duration of the variant (independent of dose size)
    return this.variant.duration;
  }

  // Serialization
  static serialize: Serializer<Insulin> = (e: Insulin) => {
    return {
      value: e.value,
      timestamp: e.timestamp.getTime(),
      variant: InsulinVariant.serialize(e.variant),
    };
  };
  static deserialize: Deserializer<Insulin> = (o) => {
    const variant: InsulinVariant = o.variant
      ? InsulinVariantManager.deserialize(o.variant)
      : InsulinVariantManager.getDefault();
    return new Insulin(o.value, new Date(o.timestamp), variant);
  };
}
