import { Bateman } from "../../lib/bateman";
import { MathUtil } from "../../lib/util";
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
   * Hours until a dose has absorbed `completionFraction` of itself
   */
  findCompletionTime(completionFraction: number, dose: number) {
    return (
      Bateman.Finv(completionFraction, this.getKa(dose), this.ke) +
      this.getDelay(dose)
    );
  }
  // We consider that once some percentage of the insulin is absorbed, it's finished
  getDuration(dose: number): number {
    return this.findCompletionTime(Bateman.completionConstant, dose);
  }
  // Hours until a dose absorbs the fastest
  getPeak(dose: number): number {
    const ka = this.getKa(dose);
    const ke = this.ke;
    const delay = this.getDelay(dose);
    if (!(ka > 0) || !(ke > 0)) return delay;
    if (Math.abs(ka - ke) < 1e-12) return delay + 1 / ka;
    return delay + Math.log(ka / ke) / (ka - ke);
  }
  // For a typical dose (D_ref or less), where the curve has its reference shape
  get duration(): number {
    return this.getDuration(this.D_ref);
  }
  get peak(): number {
    return this.getPeak(this.D_ref);
  }

  /**
   * The dose that absorbs `units` between tA and tB (hours after it's taken). A dose's size
   * changes its own curve, so the dose and its curve are solved together.
   */
  doseForAbsorbed(units: number, tA: number, tB: number): number {
    const fraction = this.unitBatemanIntegral(tA, tB, 0);
    if (!(fraction > 0)) return units > 0 ? Infinity : 0;
    // A dose at or under zero has the reference shape, so it's a straight division
    const straight = units / fraction;
    if (units <= 0) return straight;
    // Bigger doses flatten out, so they can need more than a straight division
    return MathUtil.largestWhere(
      (dose) => dose * this.unitBatemanIntegral(tA, tB, dose) <= units,
      straight,
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
