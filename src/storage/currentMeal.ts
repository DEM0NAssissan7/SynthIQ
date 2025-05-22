import StorageNode from "../lib/storageNode";
import Meal from "../models/meal";

const currentMealStorage = new StorageNode("currentmeal");
currentMealStorage.add(
  "meal",
  new Meal(new Date()),
  Meal.parse,
  Meal.stringify
);

const currentMeal = currentMealStorage.get("meal") as Meal;
export default currentMeal;

export function resetCurrentMeal() {
  currentMealStorage.set("meal", new Meal(new Date()));
}
