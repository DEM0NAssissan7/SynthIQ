import MetaFunctions, { metaKernel } from "./metaFunctions";
import NutrientProfile from "./nutrientProfile";

export default class ProteinProfile extends NutrientProfile {
  private _effect = 1.14;
  private _delay = 2.0;
  private _minTime = 4.0;
  private _plateuRate = 0.005;

  set effect(value: number) {
    this._effect = value;
    this.notify();
  }
  get effect(): number {
    return this._effect;
  }

  set delay(value: number) {
    this._delay = value;
    this.notify();
  }
  get delay(): number {
    return this._delay;
  }

  set minTime(value: number) {
    this._minTime = value;
    this.notify();
  }
  get minTime(): number {
    return this._minTime;
  }

  set plateuRate(value: number) {
    this._plateuRate = value;
    this.notify();
  }
  get plateuRate(): number {
    return this._plateuRate;
  }

  deltaBG(t: number, protein: number) {
    return metaKernel(
      t,
      protein * this._effect,
      this._delay,
      this._minTime + protein * this._plateuRate, // Plateu (hour / gram)
      MetaFunctions.C
    );
  }
  static stringify(profile: ProteinProfile) {
    return JSON.stringify({
      effect: profile.effect,
      delay: profile.delay,
      minTime: profile.minTime,
      plateuRate: profile.plateuRate,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new ProteinProfile();
    profile.effect = data.effect;
    profile.delay = data.delay;
    profile.minTime = data.minTime;
    profile.plateuRate = data.plateuRate;
    return profile;
  }
}
