import StorageNode from "../lib/storageNode";
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

// Meal Persistence
const meal = new Meal(new Date());
const mealStorageName = "meal";
wizardStorage.add(mealStorageName, meal, Meal.parse, Meal.stringify);
const wizardStorageWriteHandler = () => {
  // Subscribe to meal so anything that happens to it gets persisted
  wizardStorage.write(mealStorageName);
};
wizardStorage.get(mealStorageName).subscribe(wizardStorageWriteHandler);
