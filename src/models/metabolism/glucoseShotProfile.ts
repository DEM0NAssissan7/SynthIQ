import Subscribable from "../subscribable";
import MetaFunctions, { metaKernel } from "./metaFunctions";

export default class GlucoseShotProfile extends Subscribable {
  private _effect = 10;
  private _peak = 2 / 60;
  private _delay = 10 / 60;

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

  deltaBG(t: number, caps: number) {
    return metaKernel(
      t,
      caps * this._effect,
      this._delay,
      this._peak,
      MetaFunctions.G
    );
  }
  static stringify(profile: GlucoseShotProfile) {
    return JSON.stringify({
      effect: profile.effect,
      peak: profile.peak,
      delay: profile.delay,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new GlucoseShotProfile();
    profile.effect = data.effect;
    profile.peak = data.peak;
    profile.delay = data.delay;
    return profile;
  }
}
