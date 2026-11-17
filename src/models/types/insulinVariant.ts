import { Bateman } from "../../lib/bateman";
import type { Deserializer, Serializer } from "./types";

export class InsulinVariant {
  constructor(
    public name: string,
    public effect: number,
    public daysLife: number,
    public ka: number,
    public ke: number,
    public tDelay: number, // hours
    public D_ref: number = 5,
  ) {}

  // Dynamic bateman stuff
  private getKa(dose: number) {
    return Bateman.getDynamicKa(dose, this.D_ref, this.ka);
  }
  private getDelay(dose: number) {
    return this.tDelay + Bateman.getDynamicDelay(dose, this.D_ref);
  }

  // Bateman stuff
  unitBateman(t: number, dose: number) {
    // t is in hours
    return Bateman.f(t - this.getDelay(dose), this.getKa(dose), this.ke);
  }
  unitBatemanIntegral(tA: number, tB: number, dose: number) {
    const delay = this.getDelay(dose);
    return Bateman.area(tA - delay, tB - delay, this.getKa(dose), this.ke);
  }
  fractionActive(t: number, dose: number) {
    return 1 - Bateman.F(t - this.getDelay(dose), this.getKa(dose), this.ke);
  }

  /**
   * Duration in # of hours
   */
  findCompletionTime(completionFraction: number) {
    return Bateman.Finv(completionFraction, this.ka, this.ke) + this.tDelay;
  }
  get duration(): number {
    // We consider that once some percentage of the insulin is absorbed, it's finished
    return this.findCompletionTime(Bateman.completionConstant);
  }

  // Other useful info
  get peak(): number {
    return (
      this.tDelay +
      (this.ka === this.ke
        ? 1 / this.ka
        : Math.log(this.ka / this.ke) / (this.ka - this.ke))
    );
  }

  static serialize: Serializer<InsulinVariant> = (i: InsulinVariant) => {
    return {
      name: i.name,
      effect: i.effect,
      daysLife: i.daysLife,
      ka: i.ka,
      ke: i.ke,
      t0: i.tDelay,
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
