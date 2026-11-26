import { getHourDiff } from "../../lib/timing";
import { InsulinVariantManager } from "../../managers/insulinVariantManager";
import { InsulinVariant } from "../types/insulinVariant";
import type { Deserializer, Serializer, UUID } from "../types/types";
import MetaEvent from "./metaEvent";
import ScalarMetaEvent from "./scalarEvent";

export enum InjectionPurpose {
  Nominal = "NOMINAL",
  Basal = "BASAL",
  PreBolus = "PREBOLUS",
}
export function toInjectionPurpose(value: unknown): InjectionPurpose {
  let cleanValue = value;

  // Strip wrapping quotes if double-stringified (e.g. '"NOMINAL"')
  if (typeof cleanValue === "string") {
    cleanValue = cleanValue.trim().replace(/^["']|["']$/g, "");
  }

  const validValues = Object.values(InjectionPurpose) as string[];

  if (typeof cleanValue !== "string" || !validValues.includes(cleanValue)) {
    throw new Error(`Invalid InjectionPurpose: ${JSON.stringify(value)}`);
  }

  return cleanValue as InjectionPurpose;
}
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

  constructor(
    value: number,
    timestamp: Date,
    variant: InsulinVariant,
    public purpose = InjectionPurpose.Nominal,
    uuid: UUID | null = null,
  ) {
    super(timestamp, uuid);
    this._value = value;
    this.variant = variant;
  }

  // t is the number of hours post-injection
  private getHours(time: Date) {
    return getHourDiff(time, this.timestamp);
  }
  bateman(time: Date, unit = false) {
    const t = this.getHours(time);
    return (unit ? 1 : this.value) * this.variant.unitBateman(t, this.value);
  }
  batemanIntegral(timeA: Date, timeB: Date, unit = false) {
    const tA = this.getHours(timeA);
    const tB = this.getHours(timeB);
    return (
      (unit ? 1 : this.value) *
      this.variant.unitBatemanIntegral(tA, tB, this.value)
    );
  }
  iob(time: Date) {
    return (
      this.value * this.variant.fractionActive(this.getHours(time), this.value)
    );
  }
  absorptionRate(time: Date) {
    return this.bateman(time);
  }

  // Insulin Activity
  getActivityStatus(time: Date): boolean {
    // Active until this dose's duration is up
    return this.getHours(time) < this.duration;
  }
  get isActive(): boolean {
    return this.getActivityStatus(new Date());
  }
  get duration(): number {
    // Bigger doses absorb flatter, so they take longer
    return this.variant.getDuration(this.value);
  }

  // Serialization
  static serialize: Serializer<Insulin> = (e: Insulin) => {
    return {
      value: e.value,
      timestamp: e.timestamp.getTime(),
      variant: InsulinVariant.serialize(e.variant),
      purpose: e.purpose,
      uuid: e.uuid,
    };
  };
  static deserialize: Deserializer<Insulin> = (o) => {
    const variant: InsulinVariant = o.variant
      ? InsulinVariantManager.deserialize(o.variant)
      : InsulinVariantManager.getDefault();
    return new Insulin(
      o.value,
      new Date(o.timestamp),
      variant,
      o.purpose ? toInjectionPurpose(o.purpose) : InjectionPurpose.Nominal,
      o.uuid ?? null,
    );
  };
}
