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
