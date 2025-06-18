import StorageNode from "../lib/storageNode";
import Session from "../models/session";
import Meal from "../models/events/meal";
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

// Session Storage
wizardStorage.add("session", new Session(), Session.parse, Session.stringify);
wizardStorage.get("session").subscribe(() => {
  wizardStorage.write("session");
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
