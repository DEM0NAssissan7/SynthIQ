import Food from "../../models/food";

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
      const clonedFood = new Food(
        food.name,
        food.carbsRate,
        food.proteinRate,
        food.unit,
        food.arbitraryRise,
        food.fatRate,
        food.fiberRate,
      );
      clonedFood.amount = food.amount;
      simplified.push(clonedFood);
      continue;
    }
    existingFood.amount += food.amount;
  }
  return simplified;
}
