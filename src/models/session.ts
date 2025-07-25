import { getHourDiff, getTimestampFromOffset } from "../lib/timing";
import { convertDimensions, genUUID, MathUtil, type UUID } from "../lib/util";
import { backendStore } from "../storage/backendStore";
import Glucose from "./events/glucose";
import Insulin from "./events/insulin";
import MathSeries from "./mathSeries";
import Meal from "./events/meal";
import ReadingSeries from "./readingSeries";
import Series, { Color } from "./series";
import type MetaEvent from "./events/metaEvent";
import type MetabolismProfile from "./metabolism/metabolismProfile";
import { profile } from "../storage/metaProfileStore";
import Unit from "./unit";
import preferencesStore from "../storage/preferencesStore";
import RemoteReadings from "../lib/remote/readings";

export default class Session {
  subscriptions: (() => void)[] = [];
  uuid: UUID;

  _initialGlucose: number = profile.target;
  _endTimestamp: Date | null = null; // The end timestamp of the session
  finalBG: number | null = null;
  _isGarbage: boolean = false;

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
    setTimeout(() => this.subscriptions.forEach((f) => f()));
  }

  // Event management
  addEvent(e: MetaEvent) {
    e.subscribe(() => this.notify());
    this.notify();
  }
  removeEvent(e: MetaEvent) {
    e.unsubscribe(() => this.notify());
    this.notify();
  }

  // Meals
  addMeal(meal: Meal): void {
    this.addEvent(meal);
    this.meals.push(meal);
  }
  removeMeal(meal: Meal) {
    this.removeEvent(meal);
    this.meals = this.meals.filter((m) => m !== meal);
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
    if (this.meals.length === 0)
      throw new Error("No meal events found in session");
    return this.meals[this.meals.length - 1];
  }
  get firstMealTimestamp(): Date {
    if (this.testMeals.length !== 0) return this.testMeals[0].timestamp;
    if (this.meals.length !== 0) return this.meals[0].timestamp;
    return this.timestamp;
  }
  get firstMeal(): Meal {
    if (this.meals.length === 0)
      throw new Error("No meal events found in session");
    return this.meals[0];
  }

  // Insulins
  createInsulin(timestamp: Date, units: number): Insulin {
    const insulin = new Insulin(timestamp, units);
    this.addEvent(insulin);
    this.insulins.push(insulin);
    return insulin;
  }
  removeInsulin(insulin: Insulin) {
    this.removeEvent(insulin);
    this.insulins = this.insulins.filter((i) => i !== insulin);
  }
  get insulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    return insulin;
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
    this.addEvent(glucose);
    this.glucoses.push(glucose);
    return glucose;
  }
  removeGlucose(glucose: Glucose) {
    this.removeEvent(glucose);
    this.glucoses = this.glucoses.filter((g) => g !== glucose);
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

  // Test Meals
  addTestMeal(meal: Meal): void {
    this.addEvent(meal);
    this.testMeals.push(meal);
  }
  clearTestMeals(): void {
    this.testMeals.forEach((e) => this.removeEvent(e));
    this.testMeals = [];
  }

  // Test Insulins
  createTestInsulin(timestamp: Date, units: number): Insulin {
    const insulin = new Insulin(timestamp, units);
    this.addEvent(insulin);
    this.testInsulins.push(insulin);
    return insulin;
  }
  clearTestInsulins(): void {
    this.testInsulins.forEach((e) => this.removeEvent(e));
    this.testInsulins = [];
  }

  // Test Glucoses
  createTestGlucose(timestamp: Date, caps: number): void {
    const glucose = new Glucose(timestamp, caps);
    this.addEvent(glucose);
    this.testGlucoses.push(glucose);
  }
  clearTestGlucoses(): void {
    this.testGlucoses.forEach((e) => this.removeEvent(e));
    this.testGlucoses = [];
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
    const callback = (e: MetaEvent) => {
      if (timestamp === undefined || getHourDiff(e.timestamp, timestamp) < 0)
        timestamp = e.timestamp;
    };
    this.meals.forEach((a: MetaEvent) => callback(a));
    this.insulins.forEach((a: MetaEvent) => callback(a));
    this.glucoses.forEach((a: MetaEvent) => callback(a));

    // Tests
    this.testMeals.forEach((a: MetaEvent) => callback(a));
    this.testInsulins.forEach((a: MetaEvent) => callback(a));
    this.testGlucoses.forEach((a: MetaEvent) => callback(a));
    if (!timestamp) throw new Error("No beginning timestamp found in session");
    return timestamp;
  }
  get endTimestamp(): Date | null {
    return this._endTimestamp;
  }
  set endTimestamp(value: Date | null) {
    if (value) {
      const maxSessionLength = preferencesStore.get("maxSessionLength");
      if (this.getN(value) > maxSessionLength)
        this._endTimestamp = getTimestampFromOffset(
          this.timestamp,
          maxSessionLength
        );
      else this._endTimestamp = value;
    }
    // Set final BG once we get an end timestamp
    if (value) {
      this.pullFinalBG();
    }
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

  deltaBG(t: number, _profile_?: MetabolismProfile): number {
    const _profile = _profile_ ? _profile_ : profile;
    let retval = this._initialGlucose;

    // Meals
    this.meals.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
    );
    this.testMeals.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
    );

    // Insulin
    this.insulins.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
    );
    this.testInsulins.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
    );

    // Glucose
    this.glucoses.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
    );
    this.testGlucoses.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp), _profile))
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
      backendStore.get("minutesPerReading") / 60
    );
    return predictionSeries;
  }

  // Optimizer
  get tValues(): number[] {
    const minutesPerReading = backendStore.get("minutesPerReading");
    const numReadings =
      (this.length * convertDimensions(Unit.Time.Hour, Unit.Time.Minute)) /
      minutesPerReading;
    let retval = [];
    for (let i = 0; i < numReadings; i++)
      retval.push((minutesPerReading * i) / 60);
    return retval;
  }
  getObservedReadings() {
    if (!this.endTimestamp)
      throw new Error(
        `Cannot give total readings - there is no end timestamp!`
      );
    return RemoteReadings.getReadings(this.timestamp, this.endTimestamp);
  }
  async pullFinalBG() {
    const hoursBefore = preferencesStore.get("endingHours");
    const rawReadings = await this.getLastReadings(hoursBefore);
    if (rawReadings && !this.finalBG) {
      const readings: number[] = rawReadings.map((r: any) => r.sgv);

      const finalBG = MathUtil.median(readings);
      if (!this.finalBG) this.finalBG = finalBG;
      return finalBG;
    }
    return null;
  }

  // Initial glucose
  async pullInitialGlucose() {
    return RemoteReadings.getSugarAt(this.timestamp).then((a: any) => {
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
    console.log(session.glucoses);
    return JSON.stringify({
      uuid: session.uuid,
      initialGlucose: session.initialGlucose,
      meals: session.meals.map((a) => Meal.stringify(a)),
      testMeals: session.testMeals.map((a) => Meal.stringify(a)),
      insulins: session.insulins.map((a) => Insulin.stringify(a)),
      glucoses: session.glucoses.map((a) => Glucose.stringify(a)),
      endTimestamp: session.endTimestamp || null,
      finalBG: session.finalBG,
      isGarbage: session.isGarbage,
    });
  }
  static parse(str: string): Session {
    let o = JSON.parse(str);
    console.log(o);
    let session = new Session(false);
    session.uuid = o.uuid;
    session.initialGlucose = o.initialGlucose;
    session._endTimestamp = o.endTimestamp ? new Date(o.endTimestamp) : null;
    session.finalBG = o.finalBG || null;
    session.isGarbage = o.isGarbage || false;

    o.meals.map((a: string) => session.addMeal(Meal.parse(a)));
    o.testMeals.map((a: string) => session.addTestMeal(Meal.parse(a)));
    o.insulins.map((a: string) => {
      const insulin = Insulin.parse(a);
      session.createInsulin(insulin.timestamp, insulin.units);
    });
    o.glucoses.map((a: string) => {
      const glucose = Glucose.parse(a);
      session.createGlucose(glucose.timestamp, glucose.caps);
    });

    return session;
  }
}
