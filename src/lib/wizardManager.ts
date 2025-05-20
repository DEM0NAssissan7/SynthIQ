import Meal from "../models/meal";
import NightscoutManager from "./nightscoutManager";
import StorageNode from "./storageNode";
import type { NavigateFunction } from "react-router";

export enum WizardState {
  Intro, // Always at the beginning
  Meal,
  Insulin,
  MealConfirm,
  Summary,
  Final, // This is always at the end
}

type StateNameKey = [WizardState, string];

const stateNames: StateNameKey[] = [
  [WizardState.Intro, "intro"],
  [WizardState.Meal, "meal"],
  [WizardState.Insulin, "insulin"],
  [WizardState.MealConfirm, "mealconfirm"],
];

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
// Extend the Window interface to include the 'storage' property
declare global {
  interface Window {
    storage: StorageNode;
    meal: Meal;
  }
}
window.storage = wizardStorage;

// Storage Transience
function getStateName(state: WizardState): string {
  for (let a of stateNames) if (a[0] === state) return a[1];
  throw new Error(`Cannot find name for state ${state}`);
}
function getStateFromName(name: string): WizardState {
  for (let a of stateNames) if (a[1] === name) return a[0];
  throw new Error(`Cannot find state for name ${name}`);
}

export default class WizardManager {
  static getPageRedirect(state: WizardState): string {
    return `/wizard/${getStateName(state)}`;
  }
  static getCurrentPageRedirect(): string {
    return this.getPageRedirect(wizardStorage.get("state"));
  }

  // Movement
  static moveToPage(state: WizardState, navigate: NavigateFunction): void {
    wizardStorage.set("state", state);
    navigate(this.getPageRedirect(state));
  }
  static moveToCurrentPage(navigate: NavigateFunction): void {
    this.moveToPage(wizardStorage.get("state"), navigate);
  }

  // State Management
  static setState(state: WizardState): void {
    wizardStorage.set("state", state);
  }
  static resetState() {
    wizardStorage.reset("state");
  }

  // Confirmations
  static getMealMarked() {
    return wizardStorage.get("mealMarked");
  }
  static markMeal() {
    const meal: Meal = wizardStorage.get("meal");
    meal.timestamp = new Date();
    wizardStorage.set("mealMarked", true);
    NightscoutManager.markMeal(meal.getCarbs(), meal.getProtein());
  }
  static getInsulinMarked() {
    return wizardStorage.get("insulinMarked");
  }
  static markInsulin(units: number) {
    const meal: Meal = wizardStorage.get("meal");
    meal.insulin(new Date(), units);
    wizardStorage.set("insulinMarked", true);
    NightscoutManager.markInsulin(units);
  }
}
