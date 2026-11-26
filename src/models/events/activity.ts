import type { Deserializer, Serializer, UUID } from "../types/types";
import MetaEvent from "./metaEvent";
import ScalarMetaEvent from "./scalarEvent";

export class Activity extends MetaEvent implements ScalarMetaEvent {
  _value: number;
  set value(value: number) {
    this._value = value;
    this.notify();
  }
  get value() {
    return this._value;
  }

  constructor(
    public name: string,
    timestamp: Date,
    durationMinutes: number, // a.k.a the value
    uuid: UUID | null = null,
  ) {
    super(timestamp, uuid);
    this._value = durationMinutes;
  }

  static serialize: Serializer<Activity> = (a: Activity) => {
    return {
      name: a.name,
      timestamp: a.timestamp.toString(),
      value: a.value,
      uuid: a.uuid,
    };
  };
  static deserialize: Deserializer<Activity> = (o: any) => {
    return new Activity(o.name, new Date(o.timestamp), o.value, o.uuid ?? null);
  };
}
