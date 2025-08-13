import { getHourDiff, getTimestampFromOffset } from "../lib/timing";
import { convertDimensions, genUUID, type UUID } from "../lib/util";
import Glucose from "./events/glucose";
import Insulin from "./events/insulin";
import Meal from "./events/meal";
import type MetaEvent from "./events/metaEvent";
import { profile } from "../storage/metaProfileStore";
import Unit from "./unit";
import RemoteReadings from "../lib/remote/readings";
import SugarReading from "./types/sugarReading";
import Snapshot from "./snapshot";
import Subscribable from "./subscribable";

export default class Session extends Subscribable {
  uuid: UUID;

  snapshots: Snapshot[] = [];

  _isGarbage: boolean = false;
  notes: string = "";
  version: number = 1;

  // Save user calibrations upon creation
  insulinEffect: number = profile.insulin.effect;
  glucoseEffect: number = profile.glucose.effect;

  meals: Meal[] = [];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];

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
    snapshot.subscribe(() => {
      this.notify();
    });
    this.snapshots.push(snapshot);
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
  get finalBG() {
    return this.snapshot.finalBG.sugar;
  }
  set finalBG(sugar: number) {
    this.lastSnapshot.finalBG = sugar;
  }
  get endTimestamp() {
    return this.snapshot.finalBG.timestamp;
  }
  get initialGlucose() {
    return this.snapshot.initialBG.sugar;
  }
  set initialGlucose(sugar: number) {
    this.firstSnapshot.initialBG = sugar;
  }
  get peakGlucose() {
    return this.snapshot.peakBG.sugar;
  }
  get minGlucose() {
    return this.snapshot.minBG.sugar;
  }

  // Profile-based stuff
  get mealRise(): number {
    const finalBG = this.finalBG;
    if (!finalBG)
      throw new Error(
        `Cannot get insulin dosing: there is no final blood glucose`
      );
    const initialGlucose = this.initialGlucose;

    const totalDeltaBG = finalBG - initialGlucose;

    const glucose = this.glucose;
    const glucoseDeltaBG = glucose * profile.glucose.effect;

    const insulin = this.insulin;
    const insulinDeltaBG = insulin * this.insulinEffect;

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
  get insulinErrorCorrection(): number {
    const finalBG = this.finalBG;
    if (!finalBG)
      throw new Error(`Cannot get optimal insulin: no final blood sugar`);

    const target = profile.target;
    const glucoseRise = this.glucose * profile.glucose.effect;

    const BGError = finalBG - target; // The amount that the final blood sugar deviated from the target
    // We wanna bring BG back to target, but we also negate
    // typicalFinalBG describes the typical (i.e. without glucose) final BG if the user never took glucose. This is what we wanna correct for
    const typicalFinalBG = BGError - glucoseRise;
    const errorCorrection = typicalFinalBG / this.insulinEffect;
    return errorCorrection;
  }
  get optimalMealInsulin(): number {
    const errorCorrection = this.insulinErrorCorrection;
    const optimalMealInsulin = this.mealInsulin + errorCorrection; // This is the amount of insulin
    return optimalMealInsulin;
  }

  // Insulins
  createInsulin(timestamp: Date, units: number, BG?: number): Insulin {
    // Mark snapshot
    if (this.insulins.length !== 0 && BG) {
      this.lastSnapshot.finalBG = BG;
      const snapshot = this.addSnapshot();
      snapshot.initialBG = BG;
    }

    const insulin = new Insulin(timestamp, units);
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
  get insulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    return insulin;
  }
  get mealInsulin(): number {
    return (
      this.insulin - (this.initialGlucose - profile.target) / this.insulinEffect
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
  createGlucose(timestamp: Date, caps: number): Glucose {
    const glucose = new Glucose(timestamp, caps);
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
    this.glucoses.forEach((a: Glucose) => (glucose += a._caps));
    return glucose;
  }
  get latestGlucoseTimestamp(): Date {
    if (this.glucoses.length === 0) return this.timestamp;
    return this.glucoses[this.glucoses.length - 1].timestamp;
  }

  // Timing
  getN(timestamp: Date) {
    return getHourDiff(timestamp, this.timestamp);
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

  get length(): number {
    if (!this.endTimestamp)
      throw new Error(`Cannot give length - there is no end timestamp!`);
    return this.getN(this.endTimestamp);
  }

  getObservedReadings() {
    if (!this.endTimestamp)
      throw new Error(
        `Cannot give total readings - there is no end timestamp!`
      );
    return RemoteReadings.getReadings(this.timestamp, this.endTimestamp);
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
  static stringify(session: Session): string {
    return JSON.stringify({
      uuid: session.uuid,
      snapshots: session.snapshots.map((s) => Snapshot.stringify(s)),
      meals: session.meals.map((a) => Meal.stringify(a)),
      insulins: session.insulins.map((a) => Insulin.stringify(a)),
      glucoses: session.glucoses.map((a) => Glucose.stringify(a)),
      isGarbage: session.isGarbage,
      notes: session.notes,
      insulinEffect: session.insulinEffect,
      glucoseEffect: session.glucoseEffect,
      version: session.version,
    });
  }
  static parse(str: string): Session {
    const o = JSON.parse(str);
    let session = new Session(false);
    session.uuid = o.uuid;
    session.isGarbage = o.isGarbage || false;
    session.notes = o.notes || "";
    session.insulinEffect = o.insulinEffect || profile.insulin.effect;
    session.glucoseEffect = o.glucoseEffect || profile.glucose.effect;

    o.meals.map((a: string) => session.addMeal(Meal.parse(a)));
    o.insulins.map((a: string) => {
      const insulin = Insulin.parse(a);
      session.createInsulin(insulin.timestamp, insulin.units); // Create insulin without modifying snapshots
    });
    o.glucoses.map((a: string) => {
      const glucose = Glucose.parse(a);
      session.createGlucose(glucose.timestamp, glucose.caps);
    });

    // Compatibility
    if (!o.version) {
      // We just assume that there is only one usable snapshot for the entire session as we never recorded BGs in between
      session.addSnapshot();
      session.firstSnapshot.addReading(
        new SugarReading(o.initialGlucose, session.timestamp, true)
      );

      const endTimestamp = o.endTimestamp ? new Date(o.endTimestamp) : null;
      const finalBG = o.finalBG || null;
      if (finalBG !== null) {
        session.firstSnapshot.addReading(
          new SugarReading(finalBG, endTimestamp || new Date(), true)
        );
      }
      session.version = 1;
    } else {
      if (o.version === 1) {
        const snapshots: Snapshot[] = o.snapshots.map((a: string) =>
          Snapshot.parse(a)
        );
        snapshots.forEach((s) => session.addSnapshot(s));
      }
    }

    return session;
  }
}
