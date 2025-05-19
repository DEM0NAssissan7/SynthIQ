import { Food } from "../lib/food";
import {
  convertDimensions,
  getEpochHours,
  getEpochMinutes,
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

class Meal {
  timestamp: Date;

  carbsOffset: number = 0;
  proteinOffset: number = 0;

  foods: Food[] = [
    new Food("offsets", 1, 0, 1), // Carbs offset food
    new Food("offsets", 0, 1, 1), // Protein offset food
  ];
  insulins: Insulin[] = [];
  glucoses: Glucose[] = [];
  series: Series[] = [];

  constructor(timestamp: Date) {
    // This timestamp marks when eating _begins_
    this.timestamp = timestamp;
  }

  // Meal Tasks
  setOffsets(carbs: number, protein: number) {
    this.foods[0].amount = carbs;
    this.foods[1].amount = protein;
  }
  insulin(timestamp: Date, units: number): void {
    this.insulins.push(new Insulin(timestamp, units));
  }
  glucose(timestamp: Date, caps: number): void {
    this.glucoses.push(new Glucose(timestamp, caps));
  }

  getN(timestamp: Date) {
    return (getEpochMinutes(timestamp) - getEpochMinutes(this.timestamp)) / 60;
  }
  getMealInfo() {
    let carbs = 0,
      protein = 0,
      insulin = 0,
      glucose = 0;

    this.foods.forEach((a: Food) => {
      carbs += a.getCarbs();
      protein += a.getProtein();
    });
    this.insulins.forEach((a: Insulin) => (insulin += a.units));
    this.glucoses.forEach((a: Glucose) => (glucose += a.grams));

    return {
      carbs: carbs,
      protein: protein,
      insulin: insulin,
      glucose: glucose,
    };
  }
  deltaBG(t: number, initialGlucose: number): number {
    let retval = initialGlucose;
    this.foods.forEach((a) => (retval += a.carbsDeltaBG(t))); // Carbs

    // Protein metabolism accounts for the total meal protein, so we have to collect all of it
    retval += metaKernel(
      t,
      this.getMealInfo().protein * metaProfile.get("eprotein"),
      metaProfile.get("nprotein"),
      [
        metaProfile.get("rprotein"), // Rise (gram / hour)
        this.getMealInfo().protein / metaProfile.get("pprotein"), // Plateu (gram / hour)
        metaProfile.get("fprotein"), // Fall (gram / hour)
      ],
      MetaFunctions.P
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
  createSeriesList(
    initialGlucose: number,
    from: number,
    until: number
  ): Series[] {
    let readingSeries = new ReadingSeries(Color.Black, this.timestamp);
    const A = getTimestampFromOffset(this.timestamp, from);
    const B = getTimestampFromOffset(this.timestamp, until);
    console.log(A, B);
    readingSeries.populate(A, B);

    let predictionSeries = new MathSeries(Color.Blue, [
      (t) => this.deltaBG(t, initialGlucose),
    ]);
    const predictionCallback = () => {
      requestAnimationFrame(() => {
        predictionSeries.populate(
          from,
          until,
          nightscoutStorage.get("minutesPerReading") / 60
        );
      });
    };
    predictionCallback();
    metaProfile.subscribeGeneral(predictionCallback);

    return [readingSeries, predictionSeries];
  }
  getInitialGlucose() {
    return NightscoutManager.getSugarAt(this.timestamp);
  }

  // Storage Transience
  static stringify(meal: Meal): string {
    return JSON.stringify({
      timestamp: meal.timestamp,
      carbsOffset: meal.carbsOffset,
      proteinOffset: meal.proteinOffset,
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
    let newMeal = new Meal(timestamp);
    newMeal.carbsOffset = o.carbsOffset;
    newMeal.proteinOffset = o.proteinOffset;
    newMeal.foods = foods;
    newMeal.insulins = insulin;
    newMeal.glucoses = glucose;
    return newMeal;
  }
}

export default Meal;
