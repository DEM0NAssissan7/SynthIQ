import { Bateman } from "../../lib/bateman";
import type { Deserializer, Serializer } from "./types";

export class InsulinVariant {
  constructor(
    public name: string,
    public effect: number,
    public daysLife: number,
    public ka: number,
    public ke: number,
    public t0: number, // hours
  ) {}

  // Bateman stuff
  unitBateman(t: number) {
    // t is in hours
    return Bateman.f(t - this.t0, this.ka, this.ke);
  }
  unitBatemanIntegral(tA: number, tB: number) {
    return Bateman.area(tA - this.t0, tB - this.t0, this.ka, this.ke);
  }
  fractionActive(t: number) {
    return 1 - Bateman.F(t - this.t0, this.ka, this.ke);
  }

  /**
   * Duration in # of hours
   */
  findCompletionTime(completionFraction: number) {
    return Bateman.Finv(completionFraction, this.ka, this.ke) + this.t0;
  }
  get duration(): number {
    // We consider that once some percentage of the insulin is absorbed, it's finished
    return this.findCompletionTime(Bateman.completionConstant);
  }

  static serialize: Serializer<InsulinVariant> = (i: InsulinVariant) => {
    return {
      name: i.name,
      effect: i.effect,
      daysLife: i.daysLife,
      ka: i.ka,
      ke: i.ke,
      t0: i.t0,
    };
  };
  static deserialize: Deserializer<InsulinVariant> = (o) => {
    return new InsulinVariant(
      o.name,
      o.effect,
      o.daysLife ?? 28,
      o.ka ?? 0.5,
      o.ke ?? 0.7,
      o.t0 ?? 0,
    );
  };
}
