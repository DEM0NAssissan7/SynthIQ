import StorageNode from "../lib/storageNode";
import Meal from "../models/meal";

const currentMealStorage = new StorageNode("currentmeal");
currentMealStorage.add(
  "meal",
  new Meal(new Date()),
  Meal.parse,
  Meal.stringify
);

let currentMeal = currentMealStorage.get("meal") as Meal;
export default currentMeal;

currentMeal.subscribe(() => currentMealStorage.write("meal")); // Automatically save the meal when it changes

export function resetCurrentMeal() {
  currentMeal = new Meal(new Date());
  currentMealStorage.set("meal", currentMeal);
  currentMeal.subscribe(() => currentMealStorage.write("meal"));
}
