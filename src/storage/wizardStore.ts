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
  wizardStorage.write(mealStorageName);
});

// Meal Persistence
const meal = new Meal(new Date());
const mealStorageName = "meal";
wizardStorage.add(mealStorageName, meal, Meal.parse, Meal.stringify);
wizardStorage.get(mealStorageName).subscribe(() => {
  wizardStorage.write(mealStorageName);
});
