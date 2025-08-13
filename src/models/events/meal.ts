import Food from "../food";
import MetaEvent from "./metaEvent";
import type { Deserializer, Serializer } from "../types/types";
import Unit from "../unit";

function createCarbsOffset() {
  return new Food("Carbs Offset", 1, 0, Unit.Food.Unit, 0);
}
function createProteinOffset() {
  return new Food("Protein Offset", 0, 1, Unit.Food.Unit);
}
function createFatOffset() {
  return new Food("Fat Offset", 0, 0, Unit.Food.Unit, 1);
}
export default class Meal extends MetaEvent {
  foods: Food[] = [
    createCarbsOffset(), // Carbs offset food
    createProteinOffset(), // Protein offset food
    createFatOffset(), // Fat offset food
  ];

  constructor(timestamp: Date) {
    super(timestamp);
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
  get calories(): number {
    let calories = 0;
    const calPerCarb = 4;
    const calPerProtein = 4;
    const calPerFat = 9;
    calories += this.carbs * calPerCarb;
    calories += this.protein * calPerProtein;
    calories += this.fat * calPerFat;
    return calories;
  }

  // Storage Transience
  static serialize: Serializer<Meal> = (meal) => {
    return {
      timestamp: meal.timestamp.getTime(),
      foods: meal.foods.map((a) => Food.serialize(a)),
    };
  };
  static deserialize: Deserializer<Meal> = (o) => {
    let timestamp = new Date(o.timestamp);
    let foods: Food[] = o.foods.map((a: string) => Food.deserialize(a));
    let newMeal = new Meal(timestamp);
    newMeal.foods = foods;
    return newMeal;
  };

  copyFoods(foods: Food[]) {
    this.foods = [];
    foods.forEach((a: Food) => {
      const f = new Food(a.name, a.carbsRate, a.proteinRate, a.unit, a.fatRate);
      f.amount = a.amount;
      this.foods.push(f);
    });
  }
}
