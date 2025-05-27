import Meal from "../models/meal";
import { getStateName, WizardState } from "../models/wizardState";
import currentMeal, { resetCurrentMeal } from "../storage/currentMeal";
import { wizardStorage } from "../storage/wizardStore";
import NightscoutManager from "./nightscoutManager";
import type { NavigateFunction } from "react-router";

export default class WizardManager {
  // Page Redirects
  private static getPageRedirect(state: WizardState): string {
    return `/wizard/${getStateName(state)}`;
  }

  // Movement
  static moveToPage(state: WizardState, navigate: NavigateFunction): void {
    wizardStorage.set("state", state);
    navigate(this.getPageRedirect(state));
  }
  static moveToCurrentPage(navigate: NavigateFunction): void {
    this.moveToPage(wizardStorage.get("state"), navigate);
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
  static getInsulinMarked() {
    return wizardStorage.get("insulinMarked");
  }

  // Setters
  private static setAtomicInitialGlucose() {
    if (!this.getMealMarked() && !this.getInsulinMarked())
      currentMeal.initialGlucose = wizardStorage.get("meal").initialGlucose;
  }

  // Meal
  static markMeal() {
    if (!this.getMealMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      const timestamp = new Date();

      meal._timestamp = timestamp; // We intentionally set the timestamp directly as to not notify meal subscribers

      currentMeal.timestamp = timestamp; // Atomically set the timestamp on the actual current meal
      currentMeal.copyFoods(meal.foods); // Atomically set the foods on the actual current meal
      this.setAtomicInitialGlucose(); // Set the initial glucose on the actual current meal (if it hasn't been set)

      wizardStorage.set("mealMarked", true);

      NightscoutManager.markMeal(currentMeal.carbs, currentMeal.protein);
    }
  }
  static resetMeal() {
    const meal = new Meal(new Date());
    wizardStorage.set("meal", meal); // Reset temporary meal
    meal.subscribe(() => wizardStorage.write("meal")); // Automatically save the meal when it changes
  }

  // Insulin
  private static insulin(units: number) {
    const meal: Meal = wizardStorage.get("meal");
    const timestamp = new Date();

    meal.createInsulin(timestamp, units);

    currentMeal.createInsulin(timestamp, units); // Atomically mark insulin on the actual current meal
    this.setAtomicInitialGlucose(); // Set the initial glucose on the actual current meal (if it hasn't been set)

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
  // Glucose
  static markGlucose(caps: number) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    if (this.getInsulinMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      const timestamp = new Date();

      meal.createGlucose(timestamp, caps);
      meal.clearTestGlucoses(); // Clear test glucoses

      currentMeal.createGlucose(timestamp, caps); // Atomically mark glucose on the actual current meal

      NightscoutManager.markGlucose(caps);
    }
  }

  // Reset
  static startNew(navigate: NavigateFunction) {
    const timestamp = new Date();

    currentMeal.endTimestamp = timestamp; // Store the end time of the meal
    NightscoutManager.storeMeal(currentMeal); // Store the atomically edited meal into nightscout so we can analyze it later
    resetCurrentMeal(); // Reset actual meal

    wizardStorage.set("mealMarked", false);
    wizardStorage.set("insulinMarked", false);

    this.resetMeal(); // Reset temporary meal

    wizardStorage.set("state", WizardState.Meal);

    this.moveToCurrentPage(navigate);
  }
}
