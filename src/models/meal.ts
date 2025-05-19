import { Food } from "../lib/food";
import { getEpochMinutes } from "../lib/util";
import type Series from "./series";
import Glucose from "./glucose";
import Insulin from "./insulin";

class Meal {
  timestamp: Date;

  carbsOffset: number = 0;
  proteinOffset: number = 0;

  foods: Food[] = [];
  insulin: Insulin[] = [];
  glucose: Glucose[] = [];
  series: Series[] = [];

  constructor(timestamp: Date) {
    // This timestamp marks when eating _begins_
    this.timestamp = timestamp;
  }
  getN(timestamp: Date) {
    return (getEpochMinutes(timestamp) - getEpochMinutes(this.timestamp)) / 60;
  }
  deltaBG(t: number, initialGlucose: number): number {
    let retval = initialGlucose;
    this.foods.forEach((a) => (retval += a.deltaBG(t)));
    this.insulin.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );
    this.glucose.forEach(
      (a) => (retval += a.deltaBG(t - this.getN(a.timestamp)))
    );
    return retval;
  }

  static stringify(meal: Meal): string {
    return JSON.stringify({
      timestamp: meal.timestamp,
      carbsOffset: meal.carbsOffset,
      proteinOffset: meal.proteinOffset,
      foods: meal.foods.map((a) => Food.stringify(a)),
      insulin: meal.insulin.map((a) => Insulin.stringify(a)),
      glucose: meal.glucose.map((a) => Glucose.stringify(a)),
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
    newMeal.insulin = insulin;
    newMeal.glucose = glucose;
    return newMeal;
  }
}

export default Meal;
