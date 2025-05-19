import Unit from "../models/unit";
import { profile } from "./metabolism";
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
        this.getCarbs() * profile.get("ecarbs"),
        profile.get("ninsulin"),
        profile.get("pcarbs") * (defaultGI / this.GI),
        MetaFunctions.G
      ) +
      metaKernel(
        t,
        this.getProtein() * profile.get("eprotein"),
        profile.get("nprotein"),
        [
          profile.get("rprotein"), // Rise
          profile.get("pprotein"), // Plateu
          profile.get("fprotein"), // Fall
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
    return new Food(
      food.name,
      food.carbs,
      food.protein,
      unit,
      food.GI || defaultGI
    );
  }

  static stringify(f: Food, discludeAmount: boolean = false): string {
    // TODO
    return "";
  }
  static parse(string: string): Food {
    // TODO
    return;
    // return new Food();
  }
}

export const foods: Food[] = [];
let isImported: boolean = false;

export function importFoods(): void {
  if (!isImported) {
    importedFoods.foods.forEach((f) => {
      foods.push(Food.createFromImport(f));
    });
    return;
  } else {
    console.warn(
      `Foods: Refusing to import foods - already imported for this session.`
    );
  }
}

function getFoodByName(name: string): Food {
  for (let food of foods) if (food.name === name) return food;
  throw new Error(`Foods: could not find food with name ${name}`);
}
