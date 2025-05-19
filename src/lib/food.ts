import Unit from "../models/unit";
import { metaProfile } from "./metabolism";
import MetaFunctions from "../models/metaFunctions";
import { metaKernel } from "../models/metaFunctions";
import * as importedFoods from "../../public/foods.json";

const defaultGI = 20;

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
    unit: Unit.Food = Unit.Food.Percent,
    GI: number = defaultGI
  ) {
    this.name = name;
    this.carbsRate = carbsRate;
    this.proteinRate = proteinRate;
    this.unit = unit;
    this.GI = GI;
  }
  deltaBG(t: number): number {
    //
    return (
      metaKernel(
        t,
        this.getCarbs() * metaProfile.get("ecarbs"),
        metaProfile.get("ninsulin"),
        metaProfile.get("pcarbs") * (defaultGI / this.GI),
        MetaFunctions.G
      ) +
      metaKernel(
        t,
        this.getProtein() * metaProfile.get("eprotein"),
        metaProfile.get("nprotein"),
        [
          metaProfile.get("rprotein"), // Rise
          metaProfile.get("pprotein"), // Plateu
          metaProfile.get("fprotein"), // Fall
        ],
        MetaFunctions.P
      )
    );
  }
  getCarbs(): number {
    return (this.carbsRate / this.unit) * this.amount;
  }
  getProtein(): number {
    return (this.proteinRate / this.unit) * this.amount;
  }

  static createFromImport(food: any): Food {
    let unit: Unit.Food;
    switch (food.unit) {
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
        unit = Unit.Food.Percent;
        break;

      default:
        unit = Unit.Food.Percent;
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

  static stringify(food: Food, discludeAmount: boolean = false): string {
    // TODO
    return JSON.stringify({
      name: food.name,
      carbs: food.carbsRate,
      protein: food.proteinRate,
      fat: food.fatRate,
      units: food.unit,
      GI: food.GI,
      amount: food.amount && !discludeAmount,
    });
  }
  static parse(string: string): Food {
    // TODO
    return JSON.parse(string).map((food: any) => {
      let newFood: Food;
      try {
        newFood = getFoodByName(food.name);
      } catch (e: any) {
        console.warn(`${e} - using hardcoded info`);
        newFood = Food.createFromImport(food);
      }
      newFood.amount = food.amount || 0;
      return newFood;
    });
    // return new Food();
  }
}

export const foods: Food[] = [];
let isImported: boolean = false;

export function importFoods(): void {
  if (!isImported) {
    importedFoods.foods.forEach((food) => {
      foods.push(Food.createFromImport(food));
    });
    return;
  } else {
    console.warn(
      `Foods: Refusing to import foods - already imported for this session.`
    );
  }
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
