import MetaFunctions, { metaKernel } from "./metaFunctions";
import NutrientProfile from "./nutrientProfile";

// Metabolism Simulations
export const defaultGI = 15;

export default class CarbsProfile extends NutrientProfile {
  private _effect = 4.11;
  private _peak = 1.17;
  private _delay = 0;

  set effect(value: number) {
    this._effect = value;
    this.notify();
  }
  get effect(): number {
    return this._effect;
  }

  set peak(value: number) {
    this._peak = value;
    this.notify();
  }
  get peak(): number {
    return this._peak;
  }

  set delay(value: number) {
    this._delay = value;
    this.notify();
  }
  get delay(): number {
    return this._delay;
  }

  deltaBG(t: number, carbs: number, GI: number) {
    return metaKernel(
      t,
      carbs * this._effect,
      this._delay,
      this._peak * (defaultGI / GI),
      MetaFunctions.G // Parabolic
    );
  }
  static stringify(profile: CarbsProfile) {
    return JSON.stringify({
      effect: profile.effect,
      peak: profile.peak,
      delay: profile.delay,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new CarbsProfile();
    profile.effect = data.effect;
    profile.peak = data.peak;
    profile.delay = data.delay;
    return profile;
  }
}
