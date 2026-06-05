import type { Deserializer, Serializer } from "./types";

export class RescueVariant {
  constructor(
    public name: string,
    public duration: number,
    public carbs: number, // Carbs per unit of rescue
    public effect: number,
  ) {}

  get unitLetter(): string {
    return this.name.toLowerCase()[0][0];
  }

  static serialize: Serializer<RescueVariant> = (i: RescueVariant) => {
    return {
      name: i.name,
      duration: i.duration,
      carbs: i.carbs,
      effect: i.effect,
    };
  };
  static deserialize: Deserializer<RescueVariant> = (o) => {
    return new RescueVariant(o.name, o.duration, o.carbs || 1, o.effect);
  };
}
