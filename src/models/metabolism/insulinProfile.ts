import MetaFunctions, { metaKernel } from "./metaFunctions";
import NutrientProfile from "./nutrientProfile";

export default class InsulinProfile extends NutrientProfile {
  private _effect = 19;
  private _halfLife = 2.5;
  private _delay = 0.5;

  set effect(value: number) {
    this._effect = value;
    this.notify();
  }
  get effect() {
    return this._effect;
  }

  set halfLife(value: number) {
    this._halfLife = value;
    this.notify();
  }
  get halfLife() {
    return this._halfLife;
  }

  set delay(value: number) {
    this._delay = value;
    this.notify();
  }
  get delay() {
    return this._delay;
  }
  deltaBG(t: number, units: number) {
    return metaKernel(
      t,
      -units * this._effect,
      this._delay,
      this._halfLife,
      MetaFunctions.G // Half life decay
    );
  }
  static stringify(profile: InsulinProfile) {
    return JSON.stringify({
      effect: profile.effect,
      halfLife: profile.halfLife,
      delay: profile.delay,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new InsulinProfile();
    profile.effect = data.effect;
    profile.halfLife = data.halfLife;
    profile.delay = data.delay;
    return profile;
  }
}
