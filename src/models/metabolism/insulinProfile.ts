import Subscribable from "../subscribable";
import MetaFunctions, { metaKernel } from "./metaFunctions";

export default class InsulinProfile extends Subscribable {
  private _effect = 19;
  private _delay = 0.5;
  private _absorptionRate = 0.7;
  private _eliminationRate = 0.25;

  set effect(value: number) {
    this._effect = value;
    this.notify();
  }
  get effect() {
    return this._effect;
  }

  set delay(value: number) {
    this._delay = value;
    this.notify();
  }
  get delay() {
    return this._delay;
  }

  set absorptionRate(value: number) {
    this._absorptionRate = value;
    this.notify();
  }
  get absorptionRate() {
    return this._absorptionRate;
  }

  set eliminationRate(value: number) {
    this._eliminationRate = value;
    this.notify();
  }
  get eliminationRate() {
    return this._eliminationRate;
  }

  deltaBG(t: number, units: number) {
    return metaKernel(
      t,
      -units * this.effect,
      this.delay,
      [this.absorptionRate, this.eliminationRate],
      MetaFunctions.iB // Bateman integral
    );
  }
  plasma(t: number, units: number) {
    return metaKernel(
      t,
      units,
      this.delay,
      [this.absorptionRate, this.eliminationRate],
      MetaFunctions.B // Bateman function
    );
  }
  static stringify(profile: InsulinProfile) {
    return JSON.stringify({
      effect: profile.effect,
      delay: profile.delay,
      absorptionRate: profile.absorptionRate,
      eliminationRate: profile.eliminationRate,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new InsulinProfile();
    profile.effect = data.effect;
    profile.delay = data.delay;
    profile.absorptionRate = data.absorptionRate;
    profile.eliminationRate = data.eliminationRate;
    return profile;
  }
}
