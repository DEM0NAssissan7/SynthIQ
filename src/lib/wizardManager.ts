import Meal from "../models/meal";
import { getStateName, WizardState } from "../models/wizardState";
import { wizardStorage } from "../storage/wizardStore";
import NightscoutManager from "./nightscoutManager";
import type { NavigateFunction } from "react-router";

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
  static setState(state: WizardState, navigate?: NavigateFunction): void {
    if (state === WizardState.Meal && this.getMealMarked()) {
      console.error(
        `WizardManager: Cannot set state - meal creation is already completed.`
      );
      if (navigate) this.moveToCurrentPage(navigate);
      return;
    }
    if (state === WizardState.Insulin && this.getInsulinMarked()) {
      console.error(
        `WizardManager: Cannot set state - insulin dosing is already complete.`
      );
      if (navigate) this.moveToCurrentPage(navigate);
      return;
    }
    wizardStorage.set("state", state);
  }
  static resetState() {
    wizardStorage.reset("state");
  }

  // Activity
  static isActive() {
    return this.getMealMarked() || this.getInsulinMarked();
  }
  static isComplete() {
    return this.getMealMarked() && this.getInsulinMarked();
  }

  // Confirmations
  static getMealMarked() {
    return wizardStorage.get("mealMarked");
  }
  static markMeal() {
    if (!this.getMealMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      meal._timestamp = new Date(); // We intentionally set the timestamp directly as to not notify meal subscribers
      wizardStorage.set("mealMarked", true);
      NightscoutManager.markMeal(meal.carbs, meal.protein);
    }
  }
  static getInsulinMarked() {
    return wizardStorage.get("insulinMarked");
  }
  static markInsulin(units: number) {
    if (!this.getInsulinMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      meal.insulins = [];
      meal.createInsulin(new Date(), units);
      wizardStorage.set("insulinMarked", true);
      NightscoutManager.markInsulin(units);
    }
  }
  static startNew(navigate: NavigateFunction) {
    NightscoutManager.storeMeal(wizardStorage.get("meal")); // Store meal to analyze later
    wizardStorage.set("mealMarked", false);
    wizardStorage.set("insulinMarked", false);
    wizardStorage.set("meal", new Meal(new Date()));
    this.setState(WizardState.Meal);
    this.moveToCurrentPage(navigate);
  }
}
