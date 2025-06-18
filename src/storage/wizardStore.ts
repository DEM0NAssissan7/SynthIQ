import StorageNode from "../lib/storageNode";
import MetaEvent from "../models/event";
import Meal from "../models/meal";
import {
  getStateFromName,
  getStateName,
  WizardState,
} from "../models/wizardState";

// Persistent Storage
export const wizardStorage = new StorageNode("wizard");
wizardStorage.add("state", WizardState.Intro, getStateFromName, getStateName);
wizardStorage.add("mealMarked", false);
wizardStorage.add("insulinMarked", false);

// Meta Event Storage
wizardStorage.add(
  "event",
  new MetaEvent(),
  MetaEvent.parse,
  MetaEvent.stringify
);
wizardStorage.get("event").subscribe(() => {
  wizardStorage.write("event");
});

// Meal Persistence
const mealStorageWriteHandler = () => wizardStorage.write("meal");
export function setWizardMeal(meal: Meal) {
  wizardStorage.get("meal").unsubscribe(mealStorageWriteHandler);
  meal.subscribe(mealStorageWriteHandler);
  wizardStorage.set("meal", meal);
}
const meal = new Meal(new Date());
wizardStorage.add("meal", meal, Meal.parse, Meal.stringify);
setWizardMeal(wizardStorage.get("meal") as Meal);
