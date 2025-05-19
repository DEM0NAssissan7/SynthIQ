import Meal from "../models/meal";
import StorageNode from "./storageNode";
import type { NavigateFunction } from "react-router";

export enum WizardState {
  Intro, // Always at the beginning
  Meal,
  Insulin,
  MealConfirm,
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
const wizardStorage = new StorageNode("wizard");
wizardStorage.add("state", WizardState.Intro, getStateFromName, getStateName);
wizardStorage.add("meal", new Meal(new Date()), Meal.parse, Meal.stringify);
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
}
