import MetaEvent from "../models/event";
import Meal from "../models/meal";
import { getStateName, WizardState } from "../models/wizardState";
import { wizardStorage } from "../storage/wizardStore";
import NightscoutManager from "./nightscoutManager";
import { type NavigateFunction } from "react-router";

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

  // Meal
  static markMeal() {
    if (!this.getMealMarked()) {
      const meal: Meal = wizardStorage.get("meal");
      const event: MetaEvent = wizardStorage.get("event");
      const timestamp = new Date();

      meal.timestamp = timestamp; // We intentionally set the timestamp directly as to not notify meal subscribers
      event.addMeal(meal); // Add the meal to the event

      wizardStorage.set("mealMarked", true);

      // TODO: Use date selector
      NightscoutManager.markMeal(meal.carbs, meal.protein, new Date());
    }
  }

  // Insulin
  private static insulin(units: number) {
    const event: MetaEvent = wizardStorage.get("event");
    const timestamp = new Date();

    event.createInsulin(timestamp, units);

    wizardStorage.set("insulinMarked", true);

    // TODO: Use date selector
    NightscoutManager.markInsulin(units, new Date());
  }
  static markInsulin(units: number) {
    let event: MetaEvent = wizardStorage.get("event");
    if (this.getInsulinMarked()) {
      if (
        !confirm(
          `You are going to mark additional insulin. You've already taken ${event.insulin}u of insulin. Are you sure you want to do this?`
        )
      )
        return;
    }
    this.insulin(units);
  }
  // Glucose
  static markGlucose(caps: number) {
    // We really don't want to mark glucose if we haven't taken insulin. The glucose would never be taken because of a meal. Meals raise glucose.
    if (this.getInsulinMarked()) {
      const event: MetaEvent = wizardStorage.get("event");
      const timestamp = new Date();

      event.createGlucose(timestamp, caps);
      event.clearTestGlucoses(); // Clear test glucoses

      // TODO: Use date selector
      NightscoutManager.markGlucose(caps, new Date());
    }
  }

  // Reset
  static resetEvent() {
    const event = new MetaEvent();
    wizardStorage.set("event", event); // Reset event
    event.subscribe(() => wizardStorage.write("event")); // Automatically save the event when it changes
  }
  static resetMeal() {
    const meal = new Meal(new Date());
    wizardStorage.set("meal", meal); // Reset temporary meal
    meal.subscribe(() => wizardStorage.write("meal")); // Automatically save the meal when it changes
  }
  static resetWizard(navigate: NavigateFunction) {
    this.resetEvent(); // Reset the event

    wizardStorage.set("mealMarked", false);
    wizardStorage.set("insulinMarked", false);

    this.resetMeal(); // Reset temporary meal

    wizardStorage.set("state", WizardState.Meal);

    this.moveToCurrentPage(navigate);
  }
  static startNew(navigate: NavigateFunction) {
    const timestamp = new Date();
    const event: MetaEvent = wizardStorage.get("event");

    event.endTimestamp = timestamp; // Store the end time of the meal
    NightscoutManager.storeEvent(event); // Store the atomically edited meal into nightscout so we can analyze it later
    this.resetWizard(navigate); // Reset the wizard states
  }
}
