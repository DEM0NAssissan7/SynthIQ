import { getHourDiff, getTimestampFromOffset } from "../lib/timing";
import { convertDimensions, genUUID, MathUtil, type UUID } from "../lib/util";
import Glucose from "./events/glucose";
import Insulin from "./events/insulin";
import Meal from "./events/meal";
import type MetaEvent from "./events/metaEvent";
import Unit from "./unit";
import RemoteReadings from "../lib/remote/readings";
import Snapshot from "./snapshot";
import Subscribable from "./subscribable";
import type { Deserializer, JSONObject, Serializer } from "./types/types";
import { PreferencesStore } from "../storage/preferencesStore";
import Activity from "./events/activity";
import type { InsulinVariant } from "./types/insulinVariant";
import type { RescueVariant } from "./types/rescueVariant";
import { getBasalSensitivity } from "../lib/basal";
import { InsulinVariantStore } from "../storage/insulinVariantStore";
import { RescueVariantStore } from "../storage/rescueVariantStore";
import { useVariantGetters } from "../lib/helpers/useVariantGetters";
import type { TreatmentWindow } from "./types/treatmentWindow";
import { InsulinOptimizer } from "../lib/helpers/insulinOptimizer";
import { createWindows } from "../lib/helpers/createWindow";
import SugarReading from "./types/sugarReading";
import { PrivateStore } from "../storage/privateStore";

export default class Session extends Subscribable {
  uuid: UUID;

  _parent: UUID | null = null;

  snapshot: Snapshot = new Snapshot();

  _isGarbage: boolean = false;
  completed: boolean = false;
  notes: string = "";
  version: number = 1;

  meals: Meal[] = [];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];
  activities: Activity[] = [];

  fastingVelocity: number | null = null; // mg/dL per hour
  dailyBasal: number | null = null; // Units
  onBoardInsulins: Insulin[] = []; // Whatever was on board before session started

  constructor() {
    // This timestamp marks when eating _begins_
    super();
    this.uuid = genUUID();
  }

  // Parent
  get parent(): UUID | null {
    return this._parent;
  }
  set parent(p: UUID) {
    this._parent = p;
    this.notify();
  }

  // Meals
  addMeal(meal: Meal): void {
    this.meals.push(meal);
    this.addChildSubscribable(meal);
    this.notify();
  }
  removeMeal(meal: Meal) {
    this.meals = this.meals.filter((m) => m !== meal);
    this.removeChildSubscribable(meal);
    this.notify();
  }
  get mealMarked(): boolean {
    return this.meals.length !== 0;
  }
  get metaMeal(): Meal {
    // This is a meal that is a simplified combination of all the meals we have
    let meal = new Meal(this.firstMealTimestamp);
    this.meals.forEach((m) => meal.foods.push(...m.foods));
    return Meal.deserialize(Meal.serialize(meal)); // Return a deep copy
  }
  get carbs(): number {
    let carbs = 0;
    this.meals.forEach((a: Meal) => (carbs += a.carbs));
    return carbs;
  }
  get totalCarbs(): number {
    let netCarbs = 0;
    this.meals.forEach((a: Meal) => (netCarbs += a.totalCarbs));
    return netCarbs;
  }
  get protein(): number {
    let protein = 0;
    this.meals.forEach((a: Meal) => (protein += a.protein));
    return protein;
  }
  get fat(): number {
    let fat = 0;
    this.meals.forEach((a: Meal) => (fat += a.fat));
    return fat;
  }
  get calories(): number {
    let calories = 0;
    this.meals.forEach((a: Meal) => (calories += a.calories));
    return calories;
  }
  get latestMealTimestamp(): Date {
    if (this.meals.length !== 0)
      return this.meals[this.meals.length - 1].timestamp;
    return this.timestamp;
  }
  get latestMeal(): Meal {
    if (this.meals.length === 0)
      throw new Error("No meal events found in session");
    return this.meals[this.meals.length - 1];
  }
  get firstMealTimestamp(): Date {
    if (this.meals.length !== 0) return this.meals[0].timestamp;
    return this.timestamp;
  }
  get firstMeal(): Meal {
    if (this.meals.length === 0)
      throw new Error("No meal events found in session");
    return this.meals[0];
  }

  // Snapshot abstractions
  get finalBG(): number | null {
    return this.snapshot.finalBG ? this.snapshot.finalBG.sugar : null;
  }
  set finalBG(sugar: number) {
    this.snapshot.finalBG = sugar;
    this.completed = true;
  }
  get endTimestamp() {
    return this.snapshot.finalBG ? this.snapshot.finalBG.timestamp : null;
  }
  get initialGlucose(): number | null {
    return this.snapshot.initialBG ? this.snapshot.initialBG.sugar : null;
  }
  set initialGlucose(sugar: number) {
    this.snapshot.initialBG = sugar;
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
  get mealRise(): number {
    const finalBG = this.finalBG;
    if (!finalBG) return NaN;
    const initialGlucose = this.initialGlucose;
    if (!initialGlucose) return NaN;

    const totalDeltaBG = finalBG - initialGlucose;
    const glucoseDeltaBG = this.glucoseEffect;

    let insulinDeltaBG = 0;
    this.insulins.forEach(
      (i) => (insulinDeltaBG += i.value * i.variant.effect),
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
    const mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG;
    return mealDeltaBG;
  }
  get insulinEffect(): number {
    let mgdl = 0;
    this.insulins.forEach((i) => (mgdl += i.value * i.variant.effect));
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
  getOptimalMealInsulins(
    insulinVariants: InsulinVariant[],
    rescueVariants: RescueVariant[],
  ): Insulin[] {
    return InsulinOptimizer.getOptimalInsulins(
      this.insulins,
      this.windows,
      insulinVariants,
      rescueVariants,
    );
  }
  get optimalMealInsulins(): Insulin[] {
    return this.getOptimalMealInsulins(
      InsulinVariantStore.variants.value,
      RescueVariantStore.variants.value,
    );
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
  createInsulin(
    units: number,
    timestamp: Date,
    variant: InsulinVariant,
    BG?: number,
  ): Insulin {
    // Mark snapshot
    if (BG) this.snapshot.addReading(new SugarReading(BG, timestamp, true));

    const insulin = new Insulin(units, timestamp, variant);
    this.insulins.push(insulin);
    this.addChildSubscribable(insulin);
    this.notify();
    return insulin;
  }
  removeInsulin(insulin: Insulin) {
    const index = this.insulins.indexOf(insulin);
    if (index === -1) return; // Already gone
    this.insulins.splice(index, 1);
    this.removeChildSubscribable(insulin);
    this.notify();
  }
  get insulinMarked(): boolean {
    return this.insulins.length !== 0;
  }
  get insulin(): number {
    return this.insulins.reduce((n, i) => i.value + n, 0);
  }
  get mealInsulin(): number {
    return this.insulin - this.correctionInsulin;
  }
  getTheoreticalMealRise(
    insulinVariants: InsulinVariant[],
    rescueVariants: RescueVariant[],
  ): number {
    const { getInsulinVariant } = useVariantGetters(
      insulinVariants,
      rescueVariants,
    );
    const optimalMealInsulins = this.getOptimalMealInsulins(
      insulinVariants,
      rescueVariants,
    );
    const rise = optimalMealInsulins.reduce(
      (n, insulin) =>
        insulin.value * getInsulinVariant(insulin.variant).effect + n,
      0,
    );
    return rise;
  }
  get theoreticalMealRise(): number {
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

  // Glucoses
  createGlucose(
    grams: number,
    timestamp: Date,
    variant: RescueVariant,
  ): Glucose {
    const glucose = new Glucose(grams, timestamp, variant);
    this.glucoses.push(glucose);
    this.addChildSubscribable(glucose);
    this.notify();
    return glucose;
  }
  removeGlucose(glucose: Glucose) {
    this.glucoses = this.glucoses.filter((g) => g !== glucose);
    this.removeChildSubscribable(glucose);
    this.notify();
  }
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
  addActivity(activity: Activity) {
    this.activities.push(activity);
    this.addChildSubscribable(activity);
    this.notify();
  }

  // Timing
  getN(timestamp: Date) {
    return getHourDiff(timestamp, this.timestamp);
  }
  getRelativeN(timestamp: Date) {
    return getHourDiff(timestamp, this.firstMealTimestamp);
  }
  get timestamp() {
    let timestamp = new Date();
    const callback = (e: MetaEvent) => {
      if (timestamp === undefined || getHourDiff(e.timestamp, timestamp) < 0)
        timestamp = e.timestamp;
    };
    this.meals.forEach((a: MetaEvent) => callback(a));
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
    return this.meals.length + this.insulins.length !== 0;
  }
  set isGarbage(value: boolean) {
    this._isGarbage = value;
    this.notify();
  }
  get isGarbage(): boolean {
    return this._isGarbage;
  }
  get isInvalid(): boolean {
    return (
      this.isGarbage ||
      this.meals.length !== 1 ||
      this.insulin <= 0 ||
      (this.completed ? this.length : this.getN(new Date())) <
        PreferencesStore.minSessionLength.value ||
      this.glucoseEffect >
        ((this.initialGlucose ?? PreferencesStore.targetBG.value) -
          PreferencesStore.dangerBG.value) *
          1.414 ||
      this.activities.length !== 0
    );
  }

  get length(): number {
    if (!this.endTimestamp) return 0;
    return this.getN(this.endTimestamp);
  }
  get expired(): boolean {
    return this.age > PreferencesStore.usableSessionLife.value;
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

  // Basal
  get fastingRise(): number {
    if (!this.endTimestamp) return 0;
    return this.fastingVelocity ? this.fastingVelocity * this.length : 0;
  }
  getSensitivityIndex(liverOutput: number) {
    if (!this.fastingVelocity || !this.dailyBasal) return null;
    return getBasalSensitivity(
      liverOutput,
      this.fastingVelocity,
      this.dailyBasal,
    );
  }

  // Glucose statistics stuff
  async getLastReadings(hours: number) {
    // Give the last readings from [hours] before the end until the actual end
    let timestampB = new Date();
    if (this.endTimestamp) timestampB = this.endTimestamp;
    const timestampA = getTimestampFromOffset(timestampB, -hours);
    return RemoteReadings.getReadings(timestampA, timestampB);
  }

  // Serialization
  static serialize: Serializer<Session> = (session: Session) => {
    return {
      uuid: session.uuid,
      parent: session.parent,
      snapshot: Snapshot.serialize(session.snapshot),
      meals: session.meals.map((a) => Meal.serialize(a)),
      insulins: session.insulins.map((a) => Insulin.serialize(a)),
      glucoses: session.glucoses.map((a) => Glucose.serialize(a)),
      activities: session.activities.map((a) => Activity.serialize(a)),
      isGarbage: session.isGarbage,
      completed: session.completed,
      notes: session.notes,
      version: session.version,
      fastingVelocity: session.fastingVelocity,
      dailyBasal: session.dailyBasal,
      onBoardInsulins: session.onBoardInsulins.map((a) => Insulin.serialize(a)),
    };
  };
  static deserialize: Deserializer<Session> = (o) => {
    const session = new Session();
    session.uuid = o.uuid;
    session._parent = o.parent;
    session.isGarbage = o.isGarbage ?? false;
    session.completed = o.completed ?? true;
    session.notes = o.notes || "";
    session.fastingVelocity = o.fastingVelocity || null;
    session.dailyBasal = o.dailyBasal || null;

    o.meals.map((a: string) => session.addMeal(Meal.deserialize(a)));
    o.insulins.map((a: string) => {
      const insulin = Insulin.deserialize(a);
      session.createInsulin(insulin.value, insulin.timestamp, insulin.variant); // Create insulin without modifying snapshots
    });
    o.glucoses.map((a: string) => {
      const glucose = Glucose.deserialize(a);
      session.createGlucose(glucose.value, glucose.timestamp, glucose.variant);
    });

    const snapshot = o.snapshot
      ? Snapshot.deserialize(o.snapshot)
      : new Snapshot();
    if (o.snapshots) {
      // Migration
      const snapshots: Snapshot[] = o.snapshots.map((a: JSONObject) =>
        Snapshot.deserialize(a),
      );
      snapshots.forEach((s) => snapshot.absorb(s));
      if (PrivateStore.debugLogs.value)
        console.log(`Merged ${snapshots.length} snapshots`);
      snapshot.pullReadings();
    }
    session.snapshot = snapshot;

    const activities: Activity[] = o.activities
      ? o.activities.map((a: JSONObject) => Activity.deserialize(a))
      : [];
    activities.forEach((a) => session.addActivity(a));

    session.onBoardInsulins = o.onBoardInsulins
      ? o.onBoardInsulins.map((a: string) => Insulin.deserialize(a))
      : [];

    return session;
  };
}
