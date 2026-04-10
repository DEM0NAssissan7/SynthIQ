import type Food from "../../models/food";

export function simplifyFoods(foods: Food[]) {
  let simplified: Food[] = [];
  for (let food of foods) {
    let existingFood: Food | null = null;
    for (let f of simplified) {
      if (food.name === f.name) {
        existingFood = f;
        break;
      }
    }
    if (!existingFood) {
      simplified.push(food);
      continue;
    }
    existingFood.amount += food.amount;
  }
  return simplified;
}
