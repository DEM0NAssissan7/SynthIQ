import {
  getHourDiff,
  getTimestampFromOffset,
  timestampIsBetween,
} from "../lib/timing";
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
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import Activity from "./events/activity";
import type { InsulinVariant } from "./types/insulinVariant";
import { InsulinVariantStore } from "../storage/insulinVariantStore";

export default class Session extends Subscribable {
  uuid: UUID;

  snapshots: Snapshot[] = [];

  _isGarbage: boolean = false;
  completed: boolean = false;
  notes: string = "";
  version: number = 1;

  meals: Meal[] = [];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];
  activities: Activity[] = [];

  constructor(createSnapshot = true) {
    // This timestamp marks when eating _begins_
    super();
    this.uuid = genUUID();
    if (createSnapshot) this.addSnapshot(); // Create the initial snapshot
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
  get carbs(): number {
    let carbs = 0;
    this.meals.forEach((a: Meal) => (carbs += a.carbs));
    return carbs;
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
  addSnapshot(_snapshot?: Snapshot) {
    let snapshot: Snapshot = new Snapshot();
    if (_snapshot) snapshot = _snapshot;
    this.snapshots.push(snapshot);
    this.addChildSubscribable(snapshot);
    return snapshot;
  }
  get firstSnapshot() {
    if (this.snapshots.length === 0) throw new Error(`No snapshots exist`);
    return this.snapshots[0];
  }
  get lastSnapshot() {
    const snapshot = this.snapshots[Math.max(this.insulins.length - 1, 0)];
    if (!snapshot) throw new Error(`Latest snapshot is invalid`);
    return snapshot;
  }
  get snapshot() {
    // This is a meta snapshot that is a symbolic summation of all the snapshots
    let snapshot = new Snapshot();
    this.snapshots.forEach((s) => snapshot.absorb(s));
    return snapshot;
  }
  get finalBG(): number | null {
    return this.snapshot.finalBG ? this.snapshot.finalBG.sugar : null;
  }
  set finalBG(sugar: number) {
    this.lastSnapshot.finalBG = sugar;
    this.completed = true;
  }
  get endTimestamp() {
    return this.snapshot.finalBG ? this.snapshot.finalBG.timestamp : null;
  }
  get initialGlucose(): number | null {
    return this.snapshot.initialBG ? this.snapshot.initialBG.sugar : null;
  }
  set initialGlucose(sugar: number) {
    this.firstSnapshot.initialBG = sugar;
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
    if (!finalBG)
      throw new Error(
        `Cannot get insulin dosing: there is no final blood glucose`
      );
    const initialGlucose = this.initialGlucose;
    if (!initialGlucose)
      throw new Error(
        `Cannot get insulin dosing: there is no initial blood glucose`
      );

    const totalDeltaBG = finalBG - initialGlucose;

    const glucose = this.glucose;
    const glucoseDeltaBG = glucose * CalibrationStore.glucoseEffect.value;

    let insulinDeltaBG = 0;
    this.insulins.forEach(
      (i) => (insulinDeltaBG += i.value * i.variant.effect)
    );

    /* 
  The following statement is roughly true:
  totalDeltaBG = mealDeltaBG - insulinDeltaBG + glucoseDeltaBG

  -> Because, the total change in blood sugar is:
  The rise from the meal
  The fall from insulin
  The rise from glucoses

  Of course there's variance and other factors, but these are the major players, and all we can realistically measure

  so to rearrange to solve for effectMeal, we have:
  mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG

  */
    const mealDeltaBG = totalDeltaBG + insulinDeltaBG - glucoseDeltaBG;
    return mealDeltaBG;
  }
  get correctionInsulin(): number {
    if (this.insulins.length === 0) return 0;
    const initialBG = this.initialGlucose ?? PreferencesStore.targetBG.value;
    const insulinEffect = this.insulins[0].variant.effect;
    return Math.max(
      (initialBG - PreferencesStore.targetBG.value) / insulinEffect,
      0
    );
  }
  get optimalMealInsulins(): Insulin[] {
    /**
     * The rationale here is we basically create little windows of time
     * Each bolus shot creates a new window
     * A window contains the following info:
     *
     * InitialBG
     * Insulin amount taken
     * Glucose amount taken
     * FinalBG
     *
     * The algorithm is pretty simple. We adjust for the change in BG (accounting for glucose rise).
     * And it implicitly subtracts whatever correction insulin was taken because it attempts
     * to correct for it.
     *
     * For the first insulin, we subtract the insulin taken to correct for the current BG
     * because this function only wants to return the optimal MEAL insulin, not cumUlative.
     */

    const snapshots = this.snapshots;
    const insulins = this.insulins;
    const glucoses = this.glucoses;

    if (!this.initialGlucose)
      throw new Error(`Cannot determine insulin amount: no initial BG`);

    type TreatmentWindow = {
      initialBG: number;
      insulin: Insulin;
      oldVariant: InsulinVariant;
      glucose: number;
      finalBG: number;
    };

    // Treatment windows creation
    let windows: TreatmentWindow[] = [];
    const variants = InsulinVariantStore.variants.value;
    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const insulin = insulins[i] ?? insulins[i - 1];
      if (!snapshot.finalBG || !snapshot.initialBG)
        throw new Error(
          `Cannot reliably dictate insulin dosing: no final or inital BG`
        );
      // Find optimal variant
      const oldVariant = insulin.variant;
      for (let v of variants) {
        insulin.variant = v;
        if (v.duration > snapshot.length) break;
      }
      const window: TreatmentWindow = {
        initialBG: snapshot.initialBG.sugar,
        insulin: Insulin.deserialize(Insulin.serialize(insulin)),
        oldVariant: oldVariant,
        finalBG: snapshot.finalBG.sugar,
        glucose: 0,
      };
      // We account for glucose taken within the time frame and subtract it from the final sugar to see what it would be without any adjustment
      for (let glucose of glucoses) {
        if (
          timestampIsBetween(
            glucose.timestamp,
            snapshot.initialBG.timestamp,
            snapshot.finalBG.timestamp
          )
        ) {
          // If the glucose was taken during this window
          window.glucose += glucose.value;
        }
      }
      windows.push(window);
    }
    /**
     * Now that we have a list of the theoretical finalBGs, we can adjust each on to try and get a zero-change scenario
     */
    for (let window of windows) {
      const glucoseRise = window.glucose * CalibrationStore.glucoseEffect.value;
      const theoreticalFinalBG = window.finalBG - glucoseRise; // Avoid blaming glucose for a rise in BG
      const deltaBG = theoreticalFinalBG - window.initialBG; // Try to keep things as flat as possible

      const correction = deltaBG / window.insulin.variant.effect;
      window.insulin.value += correction;
    }

    let resultInsulins: Insulin[] = [];
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const insulin = window.insulin;
      const ISFScale = window.oldVariant.effect / insulin.variant.effect; // Scale the window's insulin by the ratio between our current ISF and the ISF when the meal was eaten
      insulin.value = insulin.value * ISFScale;
      resultInsulins.push(insulin);
    }

    return resultInsulins;
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
    BG?: number
  ): Insulin {
    // Mark snapshot
    if (this.insulins.length !== 0 && BG) {
      this.lastSnapshot.finalBG = BG;
      const snapshot = this.addSnapshot();
      snapshot.initialBG = BG;
    }

    const insulin = new Insulin(units, timestamp, variant);
    this.insulins.push(insulin);
    this.addChildSubscribable(insulin);
    this.notify();
    return insulin;
  }
  removeInsulin(insulin: Insulin) {
    this.insulins = this.insulins.filter((i) => i !== insulin);
    this.removeChildSubscribable(insulin);
    this.notify();
  }
  get insulinMarked(): boolean {
    return this.insulins.length !== 0;
  }
  get insulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.value));
    return insulin;
  }
  get mealInsulin(): number {
    return this.insulin - this.correctionInsulin;
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
  createGlucose(grams: number, timestamp: Date): Glucose {
    const glucose = new Glucose(grams, timestamp);
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
    let glucose = 0;
    this.glucoses.forEach((a: Glucose) => (glucose += a.value));
    return glucose;
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
      this.glucose > PreferencesStore.maxSessionGlucose.value
    );
  }

  get length(): number {
    if (!this.endTimestamp)
      throw new Error(`Cannot give length - there is no end timestamp!`);
    return this.getN(this.endTimestamp);
  }
  get expired(): boolean {
    return this.age > PreferencesStore.usableSessionLife.value;
  }

  getObservedReadings() {
    if (!this.endTimestamp)
      throw new Error(
        `Cannot give total readings - there is no end timestamp!`
      );
    return RemoteReadings.getReadings(this.timestamp, this.endTimestamp);
  }

  // Score
  get score(): number {
    const targetBG = PreferencesStore.targetBG.value;
    const lowThreshold = PreferencesStore.lowBG.value;
    if (
      !this.initialGlucose ||
      !this.peakGlucose ||
      !this.minGlucose ||
      !this.finalBG
    )
      throw new Error(`Cannot get glucose score from incomplete session`);
    let score = 0;
    const wentLow = this.minGlucose < lowThreshold;

    const adjustedDelta = (delta: number, tol = 3) =>
      Math.abs(delta <= tol ? 0 : delta - tol);

    if (this.initialGlucose >= targetBG) {
      score += adjustedDelta(this.peakGlucose - this.initialGlucose);
      if (wentLow) {
        score += adjustedDelta(targetBG - this.minGlucose);
      }
    } else {
      score += adjustedDelta(this.peakGlucose - targetBG);
      if (wentLow) {
        score += adjustedDelta(this.initialGlucose - this.minGlucose);
      }
    }
    if (
      (this.finalBG < targetBG && this.finalBG < lowThreshold) ||
      this.finalBG > targetBG
    )
      score += Math.abs(this.finalBG - targetBG);

    score += this.glucose * CalibrationStore.glucoseEffect.value; // Add the effect glucose had

    // Add IAD (integrated absolute deviation)
    score += MathUtil.mean(
      this.snapshot.readings.map((r) => adjustedDelta(r.sugar - targetBG))
    );

    return score;
  }

  // Initial glucose

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
      snapshots: session.snapshots.map((s) => Snapshot.serialize(s)),
      meals: session.meals.map((a) => Meal.serialize(a)),
      insulins: session.insulins.map((a) => Insulin.serialize(a)),
      glucoses: session.glucoses.map((a) => Glucose.serialize(a)),
      activities: session.activities.map((a) => Activity.serialize(a)),
      isGarbage: session.isGarbage,
      completed: session.completed,
      notes: session.notes,
      version: session.version,
    };
  };
  static deserialize: Deserializer<Session> = (o) => {
    let session = new Session(false);
    session.uuid = o.uuid;
    session.isGarbage = o.isGarbage ?? false;
    session.completed = o.completed ?? true;
    session.notes = o.notes || "";

    o.meals.map((a: string) => session.addMeal(Meal.deserialize(a)));
    o.insulins.map((a: string) => {
      const insulin = Insulin.deserialize(a);
      session.createInsulin(insulin.value, insulin.timestamp, insulin.variant); // Create insulin without modifying snapshots
    });
    o.glucoses.map((a: string) => {
      const glucose = Glucose.deserialize(a);
      session.createGlucose(glucose.value, glucose.timestamp);
    });

    const snapshots: Snapshot[] = o.snapshots.map((a: JSONObject) =>
      Snapshot.deserialize(a)
    );
    snapshots.forEach((s) => session.addSnapshot(s));

    const activities: Activity[] = o.activities
      ? o.activities.map((a: JSONObject) => Activity.deserialize(a))
      : [];
    activities.forEach((a) => session.addActivity(a));

    return session;
  };
}
