import MetaEvent from "./metaEvent";
import type { Deserializer, Serializer } from "../types/types";

export default class ScalarMetaEvent extends MetaEvent {
  _value: number;
  set value(value: number) {
    this._value = value;
    this.notify();
  }
  get value() {
    return this._value;
  }

  constructor(value: number, timestamp: Date) {
    super(timestamp);
    this._value = value;
  }

  // Serialization
  static serialize: Serializer<ScalarMetaEvent> = (e: ScalarMetaEvent) => {
    return {
      value: e.value,
      timestamp: e.timestamp.getTime(),
    };
  };
  static deserialize: Deserializer<ScalarMetaEvent> = (o) => {
    return new ScalarMetaEvent(o.value, new Date(o.timestamp));
  };
}
