import Food from "./food";
import { getEpochMinutes } from "../lib/util";
import type Series from "./series";
import type Glucose from "./glucose";
import type Insulin from "./insulin";

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
}

export default Meal;
