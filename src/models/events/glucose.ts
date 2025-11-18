import { RescueVariantManager } from "../../managers/rescueVariantManager";
import { RescueVariant } from "../types/rescueVariant";
import type { Deserializer, Serializer } from "../types/types";
import MetaEvent from "./metaEvent";
import ScalarMetaEvent from "./scalarEvent";

export default class Glucose extends MetaEvent implements ScalarMetaEvent {
  _value: number;
  variant: RescueVariant;
  set value(value: number) {
    this._value = value;
    this.notify();
  }
  get value() {
    return this._value;
  }

  constructor(value: number, timestamp: Date, variant: RescueVariant) {
    super(timestamp);
    this._value = value;
    this.variant = variant;
  }

  // Serialization
  static serialize: Serializer<Glucose> = (e: Glucose) => {
    return {
      value: e.value,
      timestamp: e.timestamp.getTime(),
      variant: RescueVariant.serialize(e.variant),
    };
  };
  static deserialize: Deserializer<Glucose> = (o) => {
    const variant: RescueVariant = o.variant
      ? RescueVariantManager.deserialize(o.variant)
      : RescueVariantManager.getDefault();
    return new Glucose(o.value, new Date(o.timestamp), variant);
  };
}
