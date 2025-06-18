import NightscoutManager from "../lib/nightscoutManager";
import { getHourDiff, getTimestampFromOffset } from "../lib/timing";
import { genUUID, type UUID } from "../lib/util";
import { nightscoutStore } from "../storage/nightscoutStore";
import Glucose from "./glucose";
import Insulin from "./insulin";
import MathSeries from "./mathSeries";
import Meal from "./meal";
import ReadingSeries from "./readingSeries";
import Series, { Color } from "./series";

export default class MetaEvent {
  subscriptions: (() => void)[] = [];
  uuid: UUID;

  _initialGlucose: number = 83;
  endTimestamp: Date | null; // The end timestamp of the event

  meals: Meal[] = [];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];

  // This is used for the prediction graph so the user can see how the meal will look
  // This is not stored in the database
  testMeals: Meal[] = [];
  testInsulins: Insulin[] = [];
  testGlucoses: Glucose[] = [];

  constructor(getInitialGlucose: boolean = true) {
    // This timestamp marks when eating _begins_
    this.endTimestamp = null;
    this.uuid = genUUID();
    if (getInitialGlucose) this.pullInitialGlucose();
  }

  // Subscriptions
  subscribe(callback: () => void) {
    this.subscriptions.push(callback);
  }
  unsubscribe(callback: () => void) {
    this.subscriptions = this.subscriptions.filter((sub) => sub !== callback);
  }
  notify() {
    this.subscriptions.forEach((f) => f());
  }

  // Meals
  addMeal(meal: Meal): void {
    meal.subscribe(() => this.notify()); // Notify the event subscribers when the meal changes
    this.meals.push(meal);
    this.notify();
  }
  removeMeal(meal: Meal) {
    meal.unsubscribe(() => this.notify()); // Unsubscribe meal from event notifications
    this.meals = this.meals.filter((m) => m !== meal);
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
  get latestMealTimestamp(): Date {
    if (this.testMeals.length !== 0)
      return this.testMeals[this.testMeals.length - 1].timestamp;
    if (this.meals.length !== 0)
      return this.meals[this.meals.length - 1].timestamp;
    return this.timestamp;
  }
  get latestMeal(): Meal {
    if (this.meals.length === 0) throw new Error("No meals found in event");
    return this.meals[this.meals.length - 1];
  }

  // Insulins
  createInsulin(timestamp: Date, units: number): void {
    this.insulins.push(new Insulin(timestamp, units));
    this.notify();
  }
  removeInsulin(insulin: Insulin) {
    this.insulins = this.insulins.filter((i) => i !== insulin);
    this.notify();
  }
  get insulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    return insulin;
  }
  get latestInsulinTimestamp(): Date {
    if (this.insulins.length === 0) return this.timestamp;
    return this.insulins[this.insulins.length - 1].timestamp;
  }

  // Glucoses
  createGlucose(timestamp: Date, caps: number): void {
    this.glucoses.push(new Glucose(timestamp, caps));
    this.notify();
  }
  removeGlucose(glucose: Glucose) {
    this.glucoses = this.glucoses.filter((g) => g !== glucose);
    this.notify();
  }
  get glucose(): number {
    let glucose = 0;
    this.glucoses.forEach((a: Glucose) => (glucose += a.caps));
    return glucose;
  }
  get latestGlucoseTimestamp(): Date {
    if (this.glucoses.length === 0) return this.timestamp;
    return this.glucoses[this.glucoses.length - 1].timestamp;
  }

  // Test Meals
  addTestMeal(meal: Meal): void {
    meal.subscribe(() => this.notify()); // Notify the event subscribers when the meal changes
    this.testMeals.push(meal);
    this.notify();
  }
  clearTestMeals(): void {
    this.testMeals.forEach((meal) => meal.unsubscribe(() => this.notify()));
    this.testMeals = [];
    this.notify();
  }

  // Test Insulins
  createTestInsulin(timestamp: Date, units: number): void {
    this.testInsulins.push(new Insulin(timestamp, units));
    this.notify();
  }
  clearTestInsulins(): void {
    this.testInsulins = [];
    this.notify();
  }

  // Test Glucoses
  createTestGlucose(timestamp: Date, caps: number): void {
    this.testGlucoses.push(new Glucose(timestamp, caps));
    this.notify();
  }
  clearTestGlucoses(): void {
    this.testGlucoses = [];
    this.notify();
  }

  // General Tests
  clearTests(): void {
    this.clearTestMeals();
    this.clearTestInsulins();
    this.clearTestGlucoses();
  }

  // Timing
  getN(timestamp: Date) {
    return getHourDiff(timestamp, this.timestamp);
  }
  get timestamp() {
    let timestamp = new Date();
    const callback = (t: Date) => {
      if (timestamp === undefined || getHourDiff(t, timestamp) < 0)
        timestamp = t;
    };
    this.meals.forEach((a: Meal) => callback(a.timestamp));
    this.insulins.forEach((a: Insulin) => callback(a.timestamp));
    this.glucoses.forEach((a: Glucose) => callback(a.timestamp));
    if (!timestamp) throw new Error("No timestamp found in event");
    return timestamp;
  }

  deltaBG(t: number): number {
    let retval = this._initialGlucose;

    // Meals
    this.meals.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );
    this.testMeals.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );

    // Insulin
    this.insulins.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );
    this.testInsulins.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );

    // Glucose
    this.glucoses.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );
    this.testGlucoses.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );

    return retval;
  }

  // Graphing
  getSeriesList(from: number, until: number): Series[] {
    return [
      this.getReadingSeries(from, until),
      this.getPredictionSeries(from, until),
    ];
  }
  getReadingSeries(from: number, until: number): ReadingSeries {
    let readingSeries = new ReadingSeries(Color.Black, this.timestamp);
    const A = getTimestampFromOffset(this.timestamp, from);
    const B = getTimestampFromOffset(this.timestamp, until);
    readingSeries.populate(A, B);
    return readingSeries;
  }
  getPredictionSeries(from: number, until: number): MathSeries {
    let predictionSeries = new MathSeries(Color.Blue, [(t) => this.deltaBG(t)]);
    predictionSeries.populate(
      from,
      until,
      nightscoutStore.get("minutesPerReading") / 60
    );
    return predictionSeries;
  }
  async pullInitialGlucose() {
    return NightscoutManager.getSugarAt(this.timestamp).then((a: any) => {
      if (a) {
        this.initialGlucose = a.sgv;
        return a;
      }
    });
  }
  get initialGlucose() {
    return this._initialGlucose;
  }
  set initialGlucose(glucose: number) {
    this._initialGlucose = glucose;
    this.notify();
  }

  // Serialization
  static stringify(event: MetaEvent): string {
    return JSON.stringify({
      uuid: event.uuid,
      initialGlucose: event.initialGlucose,
      meals: event.meals.map((a) => Meal.stringify(a)),
      testMeals: event.testMeals.map((a) => Meal.stringify(a)),
      insulins: event.insulins.map((a) => Insulin.stringify(a)),
      glucoses: event.glucoses.map((a) => Glucose.stringify(a)),
      endTimestamp: event.endTimestamp?.toISOString() || null,
    });
  }
  static parse(string: string): MetaEvent {
    let o = JSON.parse(string);
    let event = new MetaEvent(false);
    event.uuid = o.uuid;
    event.initialGlucose = o.initialGlucose;
    event.endTimestamp = o.endTimestamp ? new Date(o.endTimestamp) : null;

    o.meals.map((a: any) => event.addMeal(Meal.parse(a)));
    o.testMeals.map((a: any) => event.addTestMeal(Meal.parse(a)));
    o.insulins.map((a: any) => {
      const insulin = Insulin.parse(a);
      event.createInsulin(insulin.timestamp, insulin.units);
    });
    o.glucoses.map((a: any) => {
      const glucose = Glucose.parse(a);
      event.createGlucose(glucose.timestamp, glucose.caps);
    });

    return event;
  }
}
