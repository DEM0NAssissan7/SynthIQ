import { getHourDiff, getTimestampFromOffset } from "../lib/timing";
import { convertDimensions, MathUtil } from "../lib/util";
import Glucose from "./events/glucose";
import Insulin from "./events/insulin";
import Meal from "./events/meal";
import type MetaEvent from "./events/metaEvent";
import Unit from "./unit";
import RemoteReadings from "../lib/remote/readings";
import Snapshot from "./snapshot";
import Subscribable from "./subscribable";
import { PreferencesStore } from "../storage/preferencesStore";
import type { InsulinVariant } from "./types/insulinVariant";
import type { RescueVariant } from "./types/rescueVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { useVariantGetters } from "../lib/helpers/useVariantGetters";
import type { TreatmentWindow } from "./types/treatmentWindow";
import { InsulinRetrospectiveOptimizer } from "../lib/insulinRetrospectiveAnalyzer";
import { createWindows } from "../lib/helpers/createWindow";
import type { Activity } from "./events/activity";

export default class Session extends Subscribable {
  constructor(
    public readonly meal: Meal,
    public readonly insulins: Insulin[],
    public readonly glucoses: Glucose[],
    public readonly activities: Activity[],
    public readonly snapshot: Snapshot,
    public readonly completed: boolean,
    public readonly isGarbage: boolean,
  ) {
    // This timestamp marks when eating _begins_
    super();
    this.addChildSubscribable(this.snapshot);
  }

  // Metadata
  get uuid() {
    return this.meal.uuid;
  }
  get name() {
    return this.meal.name;
  }

  // Meals
  get carbs(): number {
    return this.meal?.carbs ?? 0;
  }
  get totalCarbs(): number {
    return this.meal?.totalCarbs ?? 0;
  }
  get protein(): number {
    return this.meal?.protein ?? 0;
  }
  get fat(): number {
    return this.meal?.fat ?? 0;
  }
  get calories(): number {
    return this.meal?.calories ?? 0;
  }

  // Snapshot abstractions
  get finalBG(): number | null {
    return this.snapshot.finalBG ? this.snapshot.finalBG.sugar : null;
  }
  get endTimestamp() {
    return this.snapshot.finalBG ? this.snapshot.finalBG.timestamp : null;
  }
  get initialGlucose(): number | null {
    return this.snapshot.initialBG ? this.snapshot.initialBG.sugar : null;
  }
  set initialGlucose(sugar: number) {
    this.snapshot.initialBG = sugar;
    this.notify();
  }
  get peakGlucose() {
    return this.snapshot.peakBG ? this.snapshot.peakBG.sugar : null;
  }
  get minGlucose() {
    return this.snapshot.minBG ? this.snapshot.minBG.sugar : null;
  }
  get deltaGlucose() {
    const initialBG = this.initialGlucose ?? 0;
    const finalBG = this.finalBG ?? 0;
    return finalBG - initialBG;
  }

  // Profile-based stuff
  get insulinEffect(): number {
    let mgdl = 0;
    this.insulins.forEach(
      (i) =>
        (mgdl +=
          (i.value - i.iob(this.endTimestamp ?? new Date())) *
          i.variant.effect),
    );
    return mgdl;
  }
  get correctionInsulin(): number {
    if (this.insulins.length === 0) return 0;
    const initialBG = this.initialGlucose ?? PreferencesStore.targetBG.value;
    const insulinEffect = this.insulins[0].variant.effect;
    return Math.max(
      (initialBG - PreferencesStore.targetBG.value) / insulinEffect,
      0,
    );
  }
  get windows(): TreatmentWindow[] {
    if (!this.initialGlucose) return [];
    return createWindows(this.insulins, this.snapshot, this.glucoses);
  }
  getOptimalInsulins(
    insulinVariants: InsulinVariant[],
    rescueVariants: RescueVariant[],
    currentBG: number | null = null,
  ): Insulin[] {
    const [optimalInsulins] = InsulinRetrospectiveOptimizer.getOptimalInsulins(
      this.insulins,
      this.snapshot,
      this.glucoses,
      currentBG,
      PreferencesStore.learningRate.value / 100,
      insulinVariants,
      rescueVariants,
    );
    return optimalInsulins;
  }
  get optimalMealInsulins(): Insulin[] {
    const [optimalInsulins] = InsulinRetrospectiveOptimizer.getOptimalInsulins(
      this.insulins,
      this.snapshot,
      this.glucoses,
      null,
      1,
      InsulinVariantStore.variants.value,
      RescueVariantStore.variants.value,
    );
    return optimalInsulins;
  }

  get optimalMealInsulin(): number {
    const optimalInsulins = this.optimalMealInsulins;
    let insulin = 0;
    optimalInsulins.forEach((i) => (insulin += i.value));
    return insulin;
  }
  get insulinAdjustment(): number {
    return this.optimalMealInsulin - this.mealInsulin;
  }

  // Insulins
  get insulinMarked(): boolean {
    return this.insulins.length !== 0;
  }
  get insulin(): number {
    return this.insulins.reduce((n, i) => i.value + n, 0);
  }
  get mealInsulin(): number {
    return this.insulin - this.correctionInsulin;
  }

  // Meal
  getTheoreticalMealRise(
    insulinVariants: InsulinVariant[],
    rescueVariants: RescueVariant[],
  ): number {
    const { getInsulinVariant, getRescueVariant } = useVariantGetters(
      insulinVariants,
      rescueVariants,
    );
    const insulinEffect = this.insulins.reduce((n, insulin) => {
      const variant = getInsulinVariant(insulin.variant);
      return (
        insulin.value *
          variant.unitBatemanIntegral(0, this.length, insulin.value) *
          variant.effect +
        n
      );
    }, 0);
    const finalBG = this.finalBG;
    if (!finalBG) return NaN;
    const initialGlucose = this.initialGlucose;
    if (!initialGlucose) return NaN;

    const totalDeltaBG = finalBG - initialGlucose;
    const glucoseDeltaBG = this.glucoses.reduce(
      (n, glucose) =>
        n + glucose.value * getRescueVariant(glucose.variant).effect,
      0,
    );

    /* 
  The following statement is roughly true:
  totalDeltaBG = mealDeltaBG - insulinDeltaBG + glucoseDeltaBG

  -> Because, the total change in blood sugar is:
  The rise from the meal
  The fall from insulin
  The rise from glucoses
  The effect from basal insulin (ignored)

  Of course there's variance and other factors, but these are the major players, and all we can realistically measure

  so to rearrange to solve for effectMeal, we have:
  mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG - [fastingRise (ignored)]

  */
    const mealDeltaBG = totalDeltaBG + insulinEffect - glucoseDeltaBG;
    return mealDeltaBG;
  }
  get mealTimestamp(): Date {
    if (!this.meal) throw Error(`Cannot get meal timestamp: no meal`);
    return this.meal.timestamp;
  }
  get mealRise(): number {
    return this.getTheoreticalMealRise(
      InsulinVariantStore.variants.value,
      RescueVariantStore.variants.value,
    );
  }
  get firstInsulinTimestamp(): Date {
    if (this.insulins.length === 0) return this.timestamp;
    return this.insulins[0].timestamp;
  }
  get latestInsulinTimestamp(): Date {
    if (this.insulins.length === 0) return this.timestamp;
    return this.insulins[this.insulins.length - 1].timestamp;
  }

  // Glucose
  get glucose(): number {
    let grams = 0;
    this.glucoses.forEach((a: Glucose) => (grams += a.carbs));
    return grams;
  }
  get glucoseDoses(): number {
    let glucose = 0;
    this.glucoses.forEach((a: Glucose) => (glucose += a.value || 0));
    return glucose;
  }
  get glucoseEffect(): number {
    let effect = 0;
    this.glucoses.forEach(
      (a: Glucose) => (effect += a.value * a.variant.effect),
    );
    return effect;
  }
  get latestGlucoseTimestamp(): Date {
    if (this.glucoses.length === 0) return this.timestamp;
    return this.glucoses[this.glucoses.length - 1].timestamp;
  }

  // Activity

  // Timing
  getN(timestamp: Date) {
    return getHourDiff(timestamp, this.timestamp);
  }
  getRelativeN(timestamp: Date) {
    return getHourDiff(timestamp, this.meal?.timestamp ?? new Date());
  }
  get timestamp() {
    let timestamp = new Date();
    const callback = (e: MetaEvent) => {
      if (timestamp === undefined || getHourDiff(e.timestamp, timestamp) < 0)
        timestamp = e.timestamp;
    };
    if (this.meal) callback(this.meal);
    this.insulins.forEach((a: MetaEvent) => callback(a));
    this.glucoses.forEach((a: MetaEvent) => callback(a));

    if (!timestamp) throw new Error("No beginning timestamp found in session");
    return timestamp;
  }
  get age(): number {
    // Session age (in days)
    const now = new Date();
    const hoursSince = getHourDiff(now, this.timestamp);
    const daysSince =
      hoursSince * convertDimensions(Unit.Time.Hour, Unit.Time.Day);
    return daysSince;
  }
  get started() {
    return this.insulins.length !== 0 || this.meal !== null;
  }
  get isInvalid(): boolean {
    const mealRise = this.mealRise;
    // Figure out if meal was marked too late
    const markedTooLate = (() => {
      if (this.insulins.length === 0 || !this.meal) return null;
      const insulin = this.insulins[0];
      const timeDiff =
        (this.meal.timestamp.getTime() - insulin.timestamp.getTime()) *
        convertDimensions(Unit.Time.Millis, Unit.Time.Hour);
      if (timeDiff <= 0) false;
      const threshold = insulin.variant.findCompletionTime(0.07, insulin.value);
      if (timeDiff <= threshold) return false;
      return true;
    })();
    return this.isGarbage ||
      this.insulin <= 0 ||
      this.meal === null ||
      this.glucoseEffect >= this.insulinEffect ||
      markedTooLate ||
      this.activities.length !== 0 ||
      Number.isNaN(mealRise)
      ? true
      : Math.floor(mealRise) <= 0;
  }

  get length(): number {
    if (!this.endTimestamp) return this.getN(new Date());
    return this.getN(this.endTimestamp);
  }
  get expired(): boolean {
    return this.age > PreferencesStore.usableSessionLife.value;
  }
  get immature(): boolean {
    return this.length < PreferencesStore.minSessionLength.value;
  }
  get readyToTransition(): boolean {
    const now = new Date();
    const elapsed = this.getN(now);

    // Can't end before grace period
    if (elapsed < PreferencesStore.maxMealGrace.value) return false;

    return true;
  }

  getObservedReadings() {
    if (!this.endTimestamp) return Promise.resolve([]);
    return RemoteReadings.getReadings(this.timestamp, this.endTimestamp);
  }

  // Score (lower is better)
  get score(): number {
    const deviations = [...this.snapshot.deviations];
    const rescuePenalty = Math.sqrt(this.glucoseEffect);
    deviations.push(rescuePenalty);
    return MathUtil.mean(deviations);
  }

  // Glucose statistics stuff
  async getLastReadings(hours: number) {
    // Give the last readings from [hours] before the end until the actual end
    let timestampB = new Date();
    if (this.endTimestamp) timestampB = this.endTimestamp;
    const timestampA = getTimestampFromOffset(timestampB, -hours);
    return RemoteReadings.getReadings(timestampA, timestampB);
  }
}
