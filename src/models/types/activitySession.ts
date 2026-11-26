import { getTimestampFromOffset } from "../../lib/timing";
import { convertDimensions, MathUtil } from "../../lib/util";
import Snapshot from "../snapshot";
import Unit from "../unit";
import Glucose from "../events/glucose";
import Subscribable from "../subscribable";
import type { Activity } from "../events/activity";

export class ActivitySession extends Subscribable {
  constructor(
    public snapshot: Snapshot,
    public glucoses: Glucose[],
    public activity: Activity,
  ) {
    super();
  }

  get name() {
    return this.activity.name;
  }
  get uuid() {
    return this.activity.uuid;
  }
  get timestamp(): Date {
    return this.activity.timestamp;
  }
  get endTimestamp(): Date {
    return getTimestampFromOffset(
      this.activity.timestamp,
      this.activity.value * convertDimensions(Unit.Time.Minute, Unit.Time.Hour),
    );
  }
  get length() {
    // Returns the length (in minutes) of the activity
    return this.activity.value;
  }

  get initialBG(): number | null {
    const reading = this.snapshot.initialBG;
    if (!reading) return null;
    return reading.sugar;
  }
  get finalBG(): number | null {
    const reading = this.snapshot.finalBG;
    if (!reading) return null;
    return reading.sugar;
  }
  get deltaBG(): number {
    const initialBG = this.initialBG;
    const finalBG = this.finalBG;
    if (!initialBG || !finalBG)
      throw new Error(`Cannot find deltaBG: no initial or final glucose`);
    return finalBG - initialBG;
  }

  get glucose(): number {
    let glucose = 0;
    this.glucoses.forEach((g) => (glucose += g.value));
    return glucose;
  }
  get glucoseEffect(): number {
    let effect = 0;
    this.glucoses.forEach((g) => (effect += g.value * g.variant.effect));
    return effect;
  }
  get latestRescueTimestamp(): Date {
    return this.glucoses[this.glucoses.length - 1]?.timestamp ?? new Date();
  }
  /**
   * This value is the rate that BG drops while doing the activity, measured in mg/dL per hour
   */
  get changeRate(): number {
    const initialBG = this.initialBG;
    const finalBG = this.finalBG;
    if (!initialBG || !finalBG)
      throw new Error(`Cannot find deltaBG: no initial or final glucose`);
    const theoreticalFinalBG = finalBG - this.glucoseEffect;
    return (
      (theoreticalFinalBG - initialBG) /
      (this.length * convertDimensions(Unit.Time.Minute, Unit.Time.Hour))
    );
  }
  /**
   * Score is a measure of how much the glucose (typically) deviates while doing the activity
   */
  get score() {
    let deviations = this.snapshot.deviations;
    // deviations.push(this.glucoseEffect);
    return MathUtil.mean(deviations);
  }
}
