/* This is where we store custom meals, foods, etc. */
import StorageNode from "../lib/storageNode";
import Food, { foods } from "../models/food";
import Meal from "../models/meal";

export const customStore = new StorageNode("custom");
customStore.add(
  "meals",
  [],
  (s: string) => {
    const mealArray = JSON.parse(s);
    return mealArray.map((a: any) => Meal.parse(a));
  },
  (meals: Meal[]) => {
    const mealArray = meals.map((a: Meal) => Meal.stringify(a));
    return JSON.stringify(mealArray);
  }
);
customStore.add(
  "foods",
  [],
  (s: string) => {
    const foodArray = JSON.parse(s);
    return foodArray.map((a: any) => Food.parse(a)); // Assuming Meal can parse food items
  },
  (foods: Food[]) => {
    const foodArray = foods.map((a: Food) => Food.stringify(a)); // Assuming Meal can stringify food items
    return JSON.stringify(foodArray);
  }
);
const customFoods = customStore.get("foods") as Food[];
customFoods.forEach((f: any) => {
  foods.push(f);
});
