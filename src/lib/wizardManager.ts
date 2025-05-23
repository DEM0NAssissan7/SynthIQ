import Meal from "../models/meal";
import { getStateName, WizardState } from "../models/wizardState";
import currentMeal, { resetCurrentMeal } from "../storage/currentMeal";
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
      const timestamp = new Date();
      meal._timestamp = timestamp; // We intentionally set the timestamp directly as to not notify meal subscribers
      currentMeal.timestamp = timestamp; // Atomically set the timestamp on the actual current meal
      currentMeal.copyFoods(meal.foods); // Atomically set the foods on the actual current meal
      currentMeal.initialGlucose = meal.initialGlucose; // Atomically set the initial glucose on the actual current meal
      wizardStorage.set("mealMarked", true);
      NightscoutManager.markMeal(currentMeal.carbs, currentMeal.protein);
    }
  }
  static getInsulinMarked() {
    return wizardStorage.get("insulinMarked");
  }
  private static insulin(units: number) {
    const meal: Meal = wizardStorage.get("meal");
    const timestamp = new Date();
    meal.createInsulin(timestamp, units);
    currentMeal.createInsulin(timestamp, units); // Atomically mark insulin on the actual current meal
    wizardStorage.set("insulinMarked", true);
    NightscoutManager.markInsulin(units);
  }
  static markInsulin(units: number) {
    const meal: Meal = wizardStorage.get("meal");
    if (!this.getInsulinMarked()) {
      meal.insulins = [];
      this.insulin(units);
    } else {
      if (
        confirm(
          `You are going to mark additional insulin. You've already taken ${meal.insulin}u of insulin. Are you sure you want to do this?`
        )
      ) {
        this.insulin(units);
      }
    }
  }
  static markGlucose(caps: number) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    // This is a safety check to make sure we don't mark glucose if we haven't taken insulin
    if (this.getInsulinMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      const timestamp = new Date();
      meal.glucoses = [];
      meal.createGlucose(timestamp, caps);
      currentMeal.createGlucose(timestamp, caps); // Atomically mark glucose on the actual current meal
      NightscoutManager.markGlucose(caps);
    }
  }
  static startNew(navigate: NavigateFunction) {
    NightscoutManager.storeMeal(currentMeal); // Store the atomically edited meal into nightscout so we can analyze it later
    wizardStorage.set("mealMarked", false);
    wizardStorage.set("insulinMarked", false);
    wizardStorage.set("meal", new Meal(new Date())); // Reset temporary meal
    resetCurrentMeal(); // Reset actual meal
    this.setState(WizardState.Meal);
    this.moveToCurrentPage(navigate);
  }
}
