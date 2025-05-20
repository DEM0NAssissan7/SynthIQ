import Unit from "../models/unit";
import { defaultGI, MetabolismFunction } from "./metabolism";
import * as importedFoods from "../assets/foods.json";

export class Food {
  name: string;
  carbsRate: number;
  proteinRate: number;
  fatRate: number = 0;
  unit: Unit.Food;
  GI: number; // Glycemic Index (carbs only)

  amount: number = 0;
  constructor(
    name: string,
    carbsRate: number,
    proteinRate: number,
    unit: Unit.Food = Unit.Food.HundredGrams,
    GI: number = defaultGI
  ) {
    this.name = name;
    this.carbsRate = carbsRate;
    this.proteinRate = proteinRate;
    this.unit = unit;
    this.GI = GI;
  }
  carbsDeltaBG(t: number): number {
    return MetabolismFunction.carbs(t, this.getCarbs(), this.GI);
  }
  getCarbs(): number {
    return (this.carbsRate / this.unit) * this.amount;
  }
  getProtein(): number {
    return (this.proteinRate / this.unit) * this.amount;
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
      food.GI || defaultGI
    );
    newFood.amount = food.amount || 0;
    return newFood;
  }

  static stringify(food: Food): string {
    // TODO
    return JSON.stringify({
      name: food.name,
      carbs: food.carbsRate,
      protein: food.proteinRate,
      fat: food.fatRate,
      units: food.unit,
      GI: food.GI,
      amount: food.amount,
    });
  }
  static parse(string: string): Food {
    let food = JSON.parse(string);
    let newFood: Food;
    try {
      newFood = getFoodByName(food.name);
    } catch (e: any) {
      console.warn(`${e} - using hardcoded info`);
      newFood = Food.createFromImport(food);
    }
    newFood.amount = food.amount || 0;
    return newFood;
  }
}

export const foods: Food[] = [];
let isImported: boolean = false;

if (!isImported) {
  importedFoods.foods.forEach((food) => {
    foods.push(Food.createFromImport(food));
  });
} else {
  console.warn(
    `Foods: Refusing to import foods - already imported for this session.`
  );
}

function getFoodByName(name: string): Food {
  for (let food of foods)
    if (food.name === name)
      return new Food(
        food.name,
        food.carbsRate,
        food.proteinRate,
        food.unit,
        food.GI
      );
  throw new Error(`Foods: could not find food with name ${name}`);
}
