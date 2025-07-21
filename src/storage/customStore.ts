/* This is where we store custom meals, foods, etc. */
import NightscoutManager from "../lib/nightscoutManager";
import StorageNode from "../lib/storageNode";
import Food, { foods } from "../models/food";

export const customStore = new StorageNode("custom");

// Custom Foods
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
let customFoods = customStore.get("foods") as Food[];
customFoods.forEach((f: any) => {
  foods.push(f);
});
function syncCustomFoods() {
  customStore.write("foods");
  NightscoutManager.storeCustomFoods();
}
export function addCustomFood(food: Food) {
  customFoods.push(food);
  foods.push(food);
  syncCustomFoods();
}
export function removeCustomFood(food: Food) {
  customFoods.splice(customFoods.indexOf(food), 1);
  foods.splice(foods.indexOf(food), 1);
  syncCustomFoods();
}
export function setCustomFoods(foods: Food[], sync: boolean = false) {
  customStore.set("foods", foods);
  customFoods = customStore.get("foods");
  if (sync) NightscoutManager.storeCustomFoods();
}
