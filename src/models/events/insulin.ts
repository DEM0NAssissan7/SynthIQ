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
    return this.value * this.variant.unitBateman(t);
  }
  batemanIntegral(timeA: Date, timeB: Date) {
    const tA = this.getHours(timeA);
    const tB = this.getHours(timeB);
    return this.value * this.variant.unitBatemanIntegral(tA, tB);
  }
  iob(time: Date) {
    return this.value * this.variant.fractionActive(this.getHours(time));
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
  get duration(): number {
    // This function return how long the insulin lasted in the system (retrospectively)
    const completionPercent =
      1 -
      PreferencesStore.insulinMinActivity.value /
        (this.value * this.variant.effect);
    return this.variant.findCompletionTime(completionPercent);
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
