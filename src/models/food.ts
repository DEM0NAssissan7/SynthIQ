import Unit from "./unit";

class Food {
  name: string;
  carbsRate: number;
  proteinRate: number;
  fatRate: number = 0;
  unit: Unit.Food;

  amount: number = 0;
  constructor(
    name: string,
    carbsRate: number,
    proteinRate: number,
    unit: Unit.Food = Unit.Food.Grams
  ) {
    this.name = name;
    this.carbsRate = carbsRate;
    this.proteinRate = proteinRate;
    this.unit = unit;
  }
}

export default Food;
