import type { Deserializer, Serializer } from "./types";

export class InsulinVariant {
  constructor(
    public name: string,
    public duration: number, // The # of hours that this insulin is active for
    public effect: number,
    public daysLife: number
  ) {}

  static serialize: Serializer<InsulinVariant> = (i: InsulinVariant) => {
    return {
      name: i.name,
      duration: i.duration,
      effect: i.effect,
      daysLife: i.daysLife,
    };
  };
  static deserialize: Deserializer<InsulinVariant> = (o) => {
    return new InsulinVariant(o.name, o.duration, o.effect, o.daysLife || 28);
  };
}
