import { genUUID } from "../lib/util";
import type Series from "./series";
import Glucose from "./glucose";
import Insulin from "./insulin";
import ReadingSeries from "./readingSeries";
import MathSeries from "./mathSeries";
import NightscoutManager from "../lib/nightscoutManager";
import { Color } from "./series";
import { nightscoutStore } from "../storage/nightscoutStore";
import Food from "./food";
import { profile } from "../storage/metaProfileStore";
import { getHourDiff, getTimestampFromOffset } from "../lib/timing";

function createCarbsOffset() {
  return new Food("Carbs Offset", 1, 0, 1);
}
function createProteinOffset() {
  return new Food("Protein Offset", 0, 1, 1);
}
function createFatOffset() {
  return new Food("Fat Offset", 0, 0, 1, 0, 1);
}
class Meal {
  _timestamp: Date;
  _initialGlucose: number = 83;
  uuid: number;

  subscriptions: (() => void)[] = [];
  foods: Food[] = [
    createCarbsOffset(), // Carbs offset food
    createProteinOffset(), // Protein offset food
    createFatOffset(), // Fat offset food
  ];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];

  constructor(timestamp: Date, getInitialGlucose: boolean = true) {
    // This timestamp marks when eating _begins_
    this._timestamp = timestamp;
    this.uuid = genUUID();
    if (getInitialGlucose) this.pullInitialGlucose();
  }

  // Meal Tasks
  set carbsOffset(grams: number) {
    this.foods[0].amount = grams;
    this.notify();
  }
  get carbsOffset() {
    return this.foods[0].amount;
  }
  set proteinOffset(grams: number) {
    this.foods[1].amount = grams;
    this.notify();
  }
  get proteinOffset() {
    return this.foods[1].amount;
  }
  set fatOffset(grams: number) {
    this.foods[2].amount = grams;
    this.notify();
  }
  get fatOffset() {
    return this.foods[2].amount;
  }
  createInsulin(timestamp: Date, units: number): void {
    this.insulins.push(new Insulin(timestamp, units));
    this.notify();
  }
  createGlucose(timestamp: Date, caps: number): void {
    this.glucoses.push(new Glucose(timestamp, caps));
    this.notify();
  }

  // Food management
  addFood(food: Food): void {
    this.foods.push(food);
    this.notify();
  }
  removeFood(food: Food): void {
    this.foods = this.foods.filter((f) => f !== food);
    this.notify();
  }
  hasFood(food: Food): boolean {
    return this.foods.some((f) => f.name === food.name);
  }
  getFood(food: Food): Food {
    return this.foods.filter((f) => f === food)[0];
  }
  setFoodAmount(food: Food, amount: number) {
    this.getFood(food).amount = amount;
    this.notify();
  }
  get addedFoods() {
    return this.foods.slice(3);
  }

  // Timing Stuff
  getN(timestamp: Date) {
    return getHourDiff(timestamp, this._timestamp);
  }
  set timestamp(timestamp: Date) {
    this._timestamp = timestamp;
    this.notify();
  }
  get timestamp() {
    return this._timestamp;
  }
  getStartTimestamp() {
    let timestamp = this._timestamp;
    const callback = (t: Date) => {
      if (getHourDiff(t, timestamp) < 0) timestamp = t;
    };
    this.insulins.forEach((a) => callback(a.timestamp));
    this.glucoses.forEach((a) => callback(a.timestamp));
    return timestamp;
  }
  get simStartOffset(): number {
    return this.getN(this.getStartTimestamp());
  }

  // Metabolism
  get carbs(): number {
    let carbs = 0;
    this.foods.forEach((a: Food) => (carbs += a.carbs));
    return carbs;
  }
  get protein(): number {
    let protein = 0;
    this.foods.forEach((a: Food) => (protein += a.protein));
    return protein;
  }
  get fat(): number {
    let fat = 0;
    this.foods.forEach((a: Food) => (fat += a.fat));
    return fat;
  }
  get insulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    return insulin;
  }
  get glucose(): number {
    let glucose = 0;
    this.glucoses.forEach((a: Glucose) => (glucose += a.grams));
    return glucose;
  }
  deltaBG(_t: number): number {
    let retval = this._initialGlucose;
    let offset = this.simStartOffset;
    const t = _t + offset;
    this.foods.forEach((a) => (retval += a.carbsDeltaBG(t))); // Carbs

    // Protein metabolism accounts for the total meal protein, so we have to collect all of it
    const protein = this.protein;
    retval += profile.protein.deltaBG(t, protein); // Protein

    // Insulin
    this.insulins.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );

    // Glucose
    this.glucoses.forEach(
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
    let readingSeries = new ReadingSeries(Color.Black, this._timestamp);
    const A = getTimestampFromOffset(this._timestamp, from);
    const B = getTimestampFromOffset(this._timestamp, until);
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
  async pullInitialGlucose(useTrueStart: boolean = true) {
    let timestamp = this.getStartTimestamp();
    if (!useTrueStart) timestamp = this._timestamp;
    return NightscoutManager.getSugarAt(timestamp).then((a: any) => {
      this.initialGlucose = a.sgv;
      return a;
    });
  }
  get initialGlucose() {
    return this._initialGlucose;
  }
  set initialGlucose(glucose: number) {
    this._initialGlucose = glucose;
    this.notify();
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

  // Storage Transience
  static stringify(meal: Meal): string {
    return JSON.stringify({
      timestamp: meal._timestamp,
      initialGlucose: meal._initialGlucose,
      uuid: meal.uuid,
      foods: meal.foods.map((a) => Food.stringify(a)),
      insulin: meal.insulins.map((a) => Insulin.stringify(a)),
      glucose: meal.glucoses.map((a) => Glucose.stringify(a)),
    });
  }
  static parse(string: string): Meal {
    let o = JSON.parse(string);
    let timestamp = new Date(o.timestamp);
    let foods = o.foods.map((a: any) => Food.parse(a));
    let insulin = o.insulin.map((a: any) => Insulin.parse(a));
    let glucose = o.glucose.map((a: any) => Glucose.parse(a));
    let newMeal = new Meal(timestamp, false);
    newMeal.uuid = o.uuid;
    newMeal._initialGlucose = o.initialGlucose;
    newMeal.foods = foods;
    newMeal.insulins = insulin;
    newMeal.glucoses = glucose;
    return newMeal;
  }

  // Misc
  get latestInsulinTimestamp(): Date {
    if (this.insulins.length === 0) return this.timestamp;
    return this.insulins[this.insulins.length - 1].timestamp;
  }
}

export default Meal;
