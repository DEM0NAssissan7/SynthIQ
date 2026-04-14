import { Bateman } from "../../lib/bateman";
import type { Deserializer, Serializer } from "./types";

export class InsulinVariant {
  constructor(
    public name: string,
    public duration: number, // The # of hours that this insulin is active for
    public effect: number,
    public daysLife: number,
    public ka: number,
    public ke: number,
  ) {}

  // Bateman stuff
  unitBateman(t: number) {
    // t is in hours
    return Bateman.f(t, this.ka, this.ke);
  }
  unitBatemanIntegral(tA: number, tB: number) {
    return Bateman.area(tA, tB, this.ka, this.ke);
  }
  fractionActive(t: number) {
    return 1 - Bateman.F(t, this.ka, this.ke);
  }

  static serialize: Serializer<InsulinVariant> = (i: InsulinVariant) => {
    return {
      name: i.name,
      duration: i.duration,
      effect: i.effect,
      daysLife: i.daysLife,
      ka: i.ka,
      ke: i.ke,
    };
  };
  static deserialize: Deserializer<InsulinVariant> = (o) => {
    return new InsulinVariant(
      o.name,
      o.duration,
      o.effect,
      o.daysLife ?? 28,
      o.ka ?? 0.5,
      o.ke ?? 0.7,
    );
  };
}
