import * as importedFoods from "../assets/foods.json";
import { genUUID, type UUID } from "../lib/util";
import Unit from "../models/unit";
import type { Deserializer, Serializer } from "./types/types";

export default class Food {
  name: string;
  carbsRate: number;
  proteinRate: number;
  fatRate: number;
  unit: Unit.Food;
  key: UUID; // This only exists to uniquely identify the food

  amount: number = 0;
  constructor(
    name: string,
    carbsRate: number,
    proteinRate: number,
    unit: Unit.Food = Unit.Food.HundredGrams,
    fatRate?: number
  ) {
    this.name = name;
    this.carbsRate = carbsRate;
    this.proteinRate = proteinRate;
    this.unit = unit;
    this.fatRate = fatRate || 0;

    this.key = genUUID();
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
      food.fat || 0
    );
    newFood.amount = food.amount || 0;
    return newFood;
  }

  static serialize: Serializer<Food> = (food: Food) => {
    // TODO
    return JSON.stringify({
      name: food.name,
      carbs: food.carbsRate,
      protein: food.proteinRate,
      fat: food.fatRate,
      units: food.unit,
      amount: food.amount,
    });
  };
  static deserialize: Deserializer<Food> = (string) => {
    let food = JSON.parse(string);
    let newFood: Food;
    try {
      newFood = getFoodByName(food.name);
    } catch (e: any) {
      // console.warn(`${e} - using hardcoded info`);
      newFood = Food.createFromImport(food);
    }
    newFood.amount = food.amount || 0;
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
        food.fatRate
      );
  throw new Error(`Foods: could not find food with name ${name}`);
}
