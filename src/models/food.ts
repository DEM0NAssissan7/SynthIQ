import Unit from "./unit";
import { profile } from "../lib/metabolism";
import MetaFunctions from "./metaFunctions";
import { metaKernel } from "./metaFunctions";

const defaultGI = 20;

export default class Food {
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
    unit: Unit.Food = Unit.Food.Grams,
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
  getCarbs() {
    return (this.carbsRate / this.unit) * this.amount;
  }
  getProtein() {
    return (this.proteinRate / this.unit) * this.amount;
  }

  // static stringify(f: Food): string {
  //   // TODO
  //   return "";
  // }
  // static parse(string: string): Food {
  //   // TODO
  //   return;
  //   // return new Food();
  // }
}

export const foods: Food[] = [];
