import Subscribable from "../subscribable";
import CarbsProfile from "./carbsProfile";
import GlucoseShotProfile from "./glucoseShotProfile";
import InsulinProfile from "./insulinProfile";
import ProteinProfile from "./proteinProfile";

export default class MetabolismProfile extends Subscribable {
  private _target: number = 83;
  private _minThreshold: number = 75;

  get target(): number {
    return this._target;
  }

  set target(value: number) {
    this._target = value;
    this.notify();
  }

  get minThreshold(): number {
    return this._minThreshold;
  }

  set minThreshold(value: number) {
    this._minThreshold = value;
    this.notify();
  }

  insulin = new InsulinProfile();
  carbs = new CarbsProfile();
  protein = new ProteinProfile();
  glucose = new GlucoseShotProfile();

  constructor() {
    super();
  }
  subscribeChildren() {
    const childProfileCallback = () => this.notify();
    this.insulin.subscribe(childProfileCallback);
    this.carbs.subscribe(childProfileCallback);
    this.protein.subscribe(childProfileCallback);
    this.glucose.subscribe(childProfileCallback);
  }

  static stringify(profile: MetabolismProfile) {
    return JSON.stringify({
      target: profile.target,
      minThreshold: profile.minThreshold,
      insulin: InsulinProfile.stringify(profile.insulin),
      carbs: CarbsProfile.stringify(profile.carbs),
      protein: ProteinProfile.stringify(profile.protein),
      glucose: GlucoseShotProfile.stringify(profile.glucose),
    });
  }
  static parse(json: string) {
    const data = JSON.parse(json);
    const profile = new MetabolismProfile();
    profile.target = data.target;
    profile.minThreshold = data.minThreshold;
    profile.insulin = InsulinProfile.parse(data.insulin);
    profile.carbs = CarbsProfile.parse(data.carbs);
    profile.protein = ProteinProfile.parse(data.protein);
    profile.glucose = GlucoseShotProfile.parse(data.glucose);
    profile.subscribeChildren();
    return profile;
  }
}
