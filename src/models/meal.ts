import { Food } from "../lib/food";
import {
  genUUID,
  getEpochMinutes,
  getHourDiff,
  getTimestampFromOffset,
} from "../lib/util";
import type Series from "./series";
import Glucose from "./glucose";
import Insulin from "./insulin";
import ReadingSeries from "./readingSeries";
import MathSeries from "./mathSeries";
import NightscoutManager, { nightscoutStorage } from "../lib/nightscoutManager";
import { Color } from "./series";
import { metaProfile } from "../lib/metabolism";
import MetaFunctions, { metaKernel } from "./metaFunctions";

function createCarbsOffset() {
  return new Food("Carbs Offset", 1, 0, 1);
}
function createProteinOffset() {
  return new Food("Protein Offset", 0, 1, 1);
}
class Meal {
  timestamp: Date;
  initialGlucose: number = 83;
  uuid: number;

  subscriptions: (() => void)[] = [];
  foods: Food[] = [
    createCarbsOffset(), // Carbs offset food
    createProteinOffset(), // Protein offset food
  ];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];

  constructor(timestamp: Date, getInitialGlucose: boolean = true) {
    // This timestamp marks when eating _begins_
    this.timestamp = timestamp;
    this.uuid = genUUID();
    if (getInitialGlucose) this.getInitialGlucose();
  }

  // Meal Tasks
  setCarbsOffset(grams: number) {
    this.foods[0].amount = grams;
    this.notify();
  }
  setProteinOffset(grams: number) {
    this.foods[1].amount = grams;
    this.notify();
  }
  getCarbsOffset() {
    return this.foods[0].amount;
  }
  getProteinOffset() {
    return this.foods[1].amount;
  }
  insulin(timestamp: Date, units: number): void {
    this.insulins.push(new Insulin(timestamp, units));
    this.notify();
  }
  glucose(timestamp: Date, caps: number): void {
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

  // Timing Stuff
  getN(timestamp: Date) {
    return (getEpochMinutes(timestamp) - getEpochMinutes(this.timestamp)) / 60;
  }
  setTimestamp(timestamp: Date) {
    this.timestamp = timestamp;
    this.notify();
  }
  getStartTimestamp() {
    let timestamp = this.timestamp;
    const callback = (t: Date) => {
      if (getHourDiff(timestamp, t) < 0) timestamp = t;
    };
    this.insulins.forEach((a) => callback(a.timestamp));
    this.glucoses.forEach((a) => callback(a.timestamp));
    return timestamp;
  }
  getSimStartOffset(): number {
    return this.getN(this.getStartTimestamp());
  }

  // Metabolism
  getCarbs(): number {
    let carbs = 0;
    this.foods.forEach((a: Food) => {
      carbs += a.getCarbs();
    });
    return carbs;
  }
  getProtein(): number {
    let protein = 0;
    this.foods.forEach((a: Food) => {
      protein += a.getProtein();
    });
    return protein;
  }
  getInsulin(): number {
    let insulin = 0;
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    return insulin;
  }
  getGlucose(): number {
    let glucose = 0;
    this.glucoses.forEach((a: Glucose) => (glucose += a.grams));
    return glucose;
  }
  deltaBG(_t: number): number {
    let retval = this.initialGlucose;
    let offset = this.getSimStartOffset();
    const t = _t + offset;
    this.foods.forEach((a) => (retval += a.carbsDeltaBG(t))); // Carbs

    // Protein metabolism accounts for the total meal protein, so we have to collect all of it
    const protein = this.getProtein();
    retval += metaKernel(
      t,
      protein * metaProfile.get("eprotein"),
      metaProfile.get("nprotein"),
      metaProfile.get("cprotein") /* The minimum time protein can take */ +
        protein * metaProfile.get("pprotein"), // Plateu (gram / hour)
      MetaFunctions.C
    );

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
      nightscoutStorage.get("minutesPerReading") / 60
    );
    return predictionSeries;
  }
  async getInitialGlucose(useTrueStart: boolean = true) {
    let timestamp = this.getStartTimestamp();
    if (!useTrueStart) timestamp = this.timestamp;
    return NightscoutManager.getSugarAt(timestamp).then((a: any) => {
      this.setInitialGlucose(a.sgv);
      return a;
    });
  }
  setInitialGlucose(glucose: number): void {
    this.initialGlucose = glucose;
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
      timestamp: meal.timestamp,
      initialGlucose: meal.initialGlucose,
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
    newMeal.initialGlucose = o.initialGlucose;
    newMeal.foods = foods;
    newMeal.insulins = insulin;
    newMeal.glucoses = glucose;
    return newMeal;
  }
}

export default Meal;
