import MetaFunctions, { metaKernel } from "./metaFunctions";
import NutrientProfile from "./nutrientProfile";

export default class GlucoseShotProfile extends NutrientProfile {
  private _effect = 4.11;
  private _peak = 6.45;
  private _delay = 0;
  private _mlsPerCap = 5;
  private _gramsPerMl = 1 / 3;

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

  set mlsPerCap(value: number) {
    this._mlsPerCap = value;
    this.notify();
  }
  get mlsPerCap(): number {
    return this._mlsPerCap;
  }

  set gramsPerMl(value: number) {
    this._gramsPerMl = value;
    this.notify();
  }
  get gramsPerMl(): number {
    return this._gramsPerMl;
  }

  get gramsPerCap(): number {
    return this._mlsPerCap * this._gramsPerMl;
  }

  deltaBG(t: number, caps: number) {
    return metaKernel(
      t,
      caps * this.gramsPerCap * this._effect,
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
      mlsPerCap: profile.mlsPerCap,
      gramsPerMl: profile.gramsPerMl,
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new GlucoseShotProfile();
    profile.effect = data.effect;
    profile.peak = data.peak;
    profile.delay = data.delay;
    profile.mlsPerCap = data.mlsPerCap;
    profile.gramsPerMl = data.gramsPerMl;
    return profile;
  }
}
