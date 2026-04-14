import { Bateman } from "../../lib/bateman";
import { getHourDiff } from "../../lib/timing";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { PreferencesStore } from "../../storage/preferencesStore";
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
  bateman(time: Date) {
    const t = this.getHours(time);
    if (t >= this.variant.duration) return 0;
    return this.value * Bateman.f(t, this.variant.ka, this.variant.ke);
  }
  bateman_integral(timeA: Date, timeB: Date) {
    const a = this.getHours(timeA);
    const b = this.getHours(timeB);
    return this.value * Bateman.area(a, b, this.variant.ka, this.variant.ke);
  }
  iob(time: Date) {
    const t = this.getHours(time);
    if (t >= this.variant.duration) return 0;
    return (
      this.value *
      (1 - Bateman.F(this.getHours(time), this.variant.ka, this.variant.ke))
    );
  }

  // Insulin Activity
  getActivityStatus(time: Date): boolean {
    const iob = this.iob(time);
    return (
      iob * this.variant.effect >= PreferencesStore.insulinMinActivity.value
    );
  }
  get isActive(): boolean {
    return this.getActivityStatus(new Date());
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
