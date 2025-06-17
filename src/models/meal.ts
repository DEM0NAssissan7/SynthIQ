import Food from "./food";
import { profile } from "../storage/metaProfileStore";

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
  timestamp: Date;
  subscriptions: (() => void)[] = [];

  foods: Food[] = [
    createCarbsOffset(), // Carbs offset food
    createProteinOffset(), // Protein offset food
    createFatOffset(), // Fat offset food
  ];

  constructor(timestamp: Date) {
    // This timestamp marks when eating _begins_
    this.timestamp = timestamp;
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

  // Carbs offset
  set carbsOffset(grams: number) {
    this.foods[0].amount = grams;
    this.notify();
  }
  get carbsOffset() {
    return this.foods[0].amount;
  }

  // Protein offset
  set proteinOffset(grams: number) {
    this.foods[1].amount = grams;
    this.notify();
  }
  get proteinOffset() {
    return this.foods[1].amount;
  }

  // Fat offset
  set fatOffset(grams: number) {
    this.foods[2].amount = grams;
    this.notify();
  }
  get fatOffset() {
    return this.foods[2].amount;
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
  deltaBG(t: number): number {
    let retval: number = 0;
    this.foods.forEach((a) => (retval += a.carbsDeltaBG(t))); // Carbs

    // Protein metabolism accounts for the total meal protein, so we have to collect all of it
    const protein = this.protein;
    retval += profile.protein.deltaBG(t, protein); // Protein

    return retval;
  }

  // Storage Transience
  static stringify(meal: Meal): string {
    return JSON.stringify({
      timestamp: meal.timestamp,
      foods: meal.foods.map((a) => Food.stringify(a)),
    });
  }
  static parse(string: string): Meal {
    let o = JSON.parse(string);
    let timestamp = new Date(o.timestamp);
    let foods = o.foods.map((a: any) => Food.parse(a));
    let newMeal = new Meal(timestamp);
    newMeal.foods = foods;
    return newMeal;
  }

  copyFoods(foods: Food[]) {
    this.foods = [];
    foods.forEach((a: Food) => {
      const f = new Food(
        a.name,
        a.carbsRate,
        a.proteinRate,
        a.unit,
        a.GI,
        a.fatRate
      );
      f.amount = a.amount;
      this.foods.push(f);
    });
  }
}

export default Meal;
