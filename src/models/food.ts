import * as importedFoods from "../assets/foods.json";
import { genUUID, type UUID } from "../lib/util";
import Unit from "../models/unit";
import type { Deserializer, Serializer } from "./types/types";

export default class Food {
  name: string;
  carbsRate: number;
  proteinRate: number;
  arbitraryRise: number;
  fatRate: number;
  fiberRate: number;
  unit: Unit.Food;
  key: UUID; // This only exists to uniquely identify the food

  amount: number = 0;
  constructor(
    name: string,
    carbsRate: number,
    proteinRate: number,
    unit: Unit.Food = Unit.Food.HundredGrams,
    arbitraryRise?: number,
    fatRate?: number,
    fiberRate?: number
  ) {
    this.name = name;
    this.carbsRate = carbsRate;
    this.proteinRate = proteinRate;
    this.unit = unit;
    this.arbitraryRise = arbitraryRise || 0;
    this.fatRate = fatRate || 0;
    this.fiberRate = fiberRate || 0;

    this.key = genUUID();
  }
  get netCarbsRate(): number {
    return this.carbsRate - this.fiberRate;
  }
  get carbs(): number {
    return (this.carbsRate / this.unit) * this.amount;
  }
  get protein(): number {
    return (this.proteinRate / this.unit) * this.amount;
  }
  get fat(): number {
    return (this.fatRate / this.unit) * this.amount;
  }
  get fiber(): number {
    return (this.fiberRate / this.unit) * this.amount;
  }
  get netCarbs(): number {
    return (this.netCarbsRate / this.unit) * this.amount;
  }
  get rise(): number {
    return (this.arbitraryRise / this.unit) * this.amount;
  }

  static createFromImport(food: any): Food {
    let unit: Unit.Food = Unit.Food.HundredGrams;
    switch (food.units) {
      case "unit":
      case 1:
      case "1":
      case "gram":
      case "oz":
      case "ounce":
        unit = Unit.Food.Unit;
        break;

      case "percent":
      case "100grams":
        unit = Unit.Food.HundredGrams;
        break;
    }
    const newFood = new Food(
      food.name,
      food.carbs,
      food.protein,
      unit,
      food.rise || 0,
      food.fat || 0,
      food.fiber || 0
    );
    newFood.amount = food.amount || 0;
    return newFood;
  }

  static serialize: Serializer<Food> = (food: Food) => {
    // TODO
    return {
      name: food.name,
      carbs: food.carbsRate,
      protein: food.proteinRate,
      rise: food.arbitraryRise,
      fat: food.fatRate,
      fiber: food.fiberRate,
      units: food.unit,
      amount: food.amount,
    };
  };
  static deserialize: Deserializer<Food> = (o) => {
    let newFood: Food;
    try {
      newFood = getFoodByName(o.name);
    } catch (e: any) {
      // console.warn(`${e} - using hardcoded info`);
      newFood = Food.createFromImport(o);
    }
    newFood.amount = o.amount || 0;
    return newFood;
  };
}

export const foods: Food[] = [];
let isImported: boolean = false;
if (!isImported) {
  importedFoods.foods.forEach((f) => {
    foods.push(Food.createFromImport(f));
  });
} else {
  console.warn(
    `Foods: Refusing to import foods - already imported for this session.`
  );
}

export function getFoodByName(name: string): Food {
  for (let food of foods)
    if (food.name === name)
      return new Food(
        food.name,
        food.carbsRate,
        food.proteinRate,
        food.unit,
        food.arbitraryRise,
        food.fatRate,
        food.fiberRate
      );
  throw new Error(`Foods: could not find food with name ${name}`);
}
